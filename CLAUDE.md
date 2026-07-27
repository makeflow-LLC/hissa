# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

"منصة حصة" (Hissa Platform) is an Arabic-language, RTL digital-school platform built with Next.js and Supabase. Students browse a searchable teacher directory; each teacher profile offers a curriculum of recorded lessons organized into units plus enrollable live sessions.

**Business model:** the platform is **free for students** — no payments ever flow through it. Teachers set their own pricing per live session; a paid session creates an enrollment with status `pending_payment` and the teacher settles it directly with the student over WhatsApp.

**Access tiers:**

| | Visitor (not signed in) | Signed-in student |
|---|---|---|
| Directory, search, filter, any profile | ✅ | ✅ |
| Lesson titles + descriptions | ✅ | ✅ |
| Full lesson content (video, explanation, gallery) | ❌ — except the one lesson flagged `is_free_preview` per teacher | ✅ all lessons |
| Attachments, quizzes | ❌ | ✅ |
| Enroll in sessions, follow teachers, save progress | ❌ | ✅ |

Locked rows show a "سجّل الدخول للمشاهدة" badge; locked lesson pages show a full sign-in panel.

## Commands

```bash
npm install        # install dependencies
npm run dev        # development server on http://localhost:3000
npm run build      # production build (also type-checks)
npm run start      # serve the production build
npm run seed       # port lib/teachers.ts mock data into Supabase (needs service-role key)
```

There is no test suite; `npm run build` is the verification gate (compile + TypeScript check). Database security is verified by role-switching SQL run through the Supabase MCP tools (see "Verifying access tiers").

## Supabase

Live project ref `mexpmtuqhvnphgeqqjuf`, region `eu-central-1`, URL `https://mexpmtuqhvnphgeqqjuf.supabase.co`. Schema, RLS and the six seeded teachers (12 units / 30 lessons / 90 attachments / 18 live sessions) are all applied.

**`.env.local` is optional for running the app**: the project URL and publishable (anon) key are baked into `lib/supabase/config.ts` as defaults — they are public by design (sent to every browser); RLS is the security boundary. Env vars, when present, override the defaults. The one secret that must live only in `.env.local` (never commit — `.gitignore` covers `.env*`; template in `.env.example`):

```bash
SUPABASE_SERVICE_ROLE_KEY=<secret key>   # npm run seed only — never NEXT_PUBLIC_
```

> **Sandbox note:** this environment's network policy blocks `*.supabase.co`, so `npm run seed` and any runtime query fail here with "Host not in allowlist". Schema/data changes from inside a session must go through the Supabase MCP tools. Pages degrade to a server-rendered `ConnectionNotice` instead of crashing, so `npm run build` and route smoke tests still work offline.

### Tables

`teachers`, `units`, `lessons`, `lesson_attachments`, `quiz_questions`, `live_sessions`, `profiles`, `subscriptions`, `enrollments`, `follows`, `lesson_progress`.

- `lessons.is_free_preview` — the one visitor-visible lesson per teacher (seeded as unit 0 / position 0).
- `live_sessions.is_paid` / `price` / `currency` — teacher-set pricing, default free.
- `enrollments.status` — `enrolled` | `pending_payment` | `cancelled`.
- `lesson_progress` — one row per completed lesson (`completed`, `completed_at`).
- `subscriptions` is legacy and unused by the app; `follows` is what "تابع هذا المعلم" writes.

### Migrations (`supabase/migrations/`)

| File | Purpose |
|---|---|
| `0001_init.sql` | base schema + indexes |
| `0002_rls.sql` | RLS on every table; owner-write via `teachers.owner_id = auth.uid()` |
| `0003_student_access.sql` | pricing/preview columns, `enrollments`, `follows`, RLS, `handle_new_user` trigger |
| `0004_visitor_column_gating.sql` | **column privileges** hiding lesson content from `anon` + `get_free_preview_content()` RPC |
| `0005_lock_down_trigger_function.sql` | revoke API execute on the trigger function |
| `0006_teacher_accounts.sql` | `qualification`, `experience_years`, `is_published` + owner INSERT policy |
| `0007_lesson_media_storage.sql` | `lesson-media` storage bucket + owner-folder upload policies |
| `0008_student_profiles_messages_grants.sql` | student profile columns, `teacher_messages`, `student_grants`, `is_restricted` + RLS |

### Rich lesson content (the `sections` column)

Lesson explanations are authored in a TipTap editor (`components/RichTextEditor.tsx`) and stored as **HTML inside the existing `sections` JSONB column** — `[{heading, html}]`. Storing it there is deliberate: `sections` is already denied to `anon` by `0004`'s column privileges, so rich content inherits the visitor gate for free. **Do not move lesson content to a new column** without also revoking that column from `anon` and adding it to `get_free_preview_content()`.

The legacy shape `[{heading, paragraphs[]}]` still renders — `ContentSection` has both fields optional and the lesson page falls back to `paragraphs` when `html` is absent.

**Sanitizing is mandatory and happens twice** (`lib/sanitize.ts`). Teacher signup is open to anyone, so lesson HTML is untrusted input rendered into students' browsers; unsanitized it is a session-stealing XSS hole. `sanitizeLessonHtml()` runs in `saveLesson` before the write *and* again in the lesson page before `dangerouslySetInnerHTML`, so safety never depends on what is already stored. The allowlist covers formatting, lists, tables and images; it drops scripts, event handlers, `javascript:`/`data:` URLs, iframes and forms, and **restricts `<img src>` to the project's own Supabase host** so teachers cannot beacon-track students with external images.

Images upload from the browser to the `lesson-media` bucket at `<auth.uid()>/<uuid>.jpg` (resized to ≤1280px client-side). The storage policy keys on that first path segment, so a teacher can only write inside their own folder. The bucket is public-read: URLs live inside the gated `sections` column and are UUID-random, but anyone holding a URL can open the image — an accepted trade-off, since the gate exists to encourage signup rather than to protect secrets.

TipTap only ships in the teacher's authoring bundle (~318 kB on `/teacher/me/lessons/*`); the student lesson page renders server-side HTML and stays ~108 kB.

### How visitor gating is enforced

RLS filters rows, not columns — so content hiding uses **column privileges**: `anon` may select only lesson metadata (`title`, `description`, `duration`, …) and is denied `sections`, `gallery`, `video_url`. `authenticated` gets full select. The single escape hatch is the `security definer` function `get_free_preview_content(lesson_id)`, which returns content **only** for rows where `is_free_preview = true`. Attachments and quizzes require `auth.uid() is not null` via RLS.

The gate therefore cannot be bypassed by calling the REST API directly — do not "fix" it by loosening these grants.

Supabase's security advisor flags `get_free_preview_content` as an anon-executable `security definer` function. **That warning is expected and intentional** — it is the free-preview gate.

### Verifying access tiers

Security is verified with SQL that switches `role` and `request.jwt.claims` to impersonate `anon` and two distinct students, asserting: visitor reads titles but not content, sees zero attachments/quizzes, and can open only the free preview; a signed-in student reads all content and 90 attachments; and student B sees none of student A's enrollments/follows/progress and cannot insert rows under A's id. Re-run this after any RLS or grant change, then drop the temporary test functions and test `auth.users` rows.

## Architecture

- **Next.js 15 App Router**, React 19, TypeScript. **All data-backed routes are `force-dynamic`** — output depends on auth state, so static/ISR caching would serve the wrong tier. Do not add `generateStaticParams` back to these routes.
- **RTL/Arabic-first**: root layout sets `lang="ar" dir="rtl"`. Keep new UI text Arabic and direction-aware (logical CSS properties or direction-neutral flex/grid).
- **`middleware.ts` + `lib/supabase/middleware.ts`** — refreshes the Supabase session cookie on every request. Without it a student's token expires without renewal and the server sees an anonymous visitor.
- **`lib/supabase/client.ts` / `server.ts`** — browser and server clients (`@supabase/ssr`).
- **`lib/data/types.ts` / `queries.ts`** — the only place that reads Supabase. `getCurrentUser()` and `getStudentName()` **fail closed** (any error ⇒ treated as visitor) because they run inside the root layout; a throw there would take down every page including the error boundary. Page-level queries throw and each page catches into `ConnectionNotice`.
- **`app/actions/student.ts`** — server actions: `enrollInSession` (free ⇒ `enrolled`, paid ⇒ `pending_payment`), `cancelEnrollment`, `toggleFollow`, `toggleLessonComplete`. Each re-validates auth server-side and calls `revalidatePath`.

### Routes

| Route | Notes |
|---|---|
| `app/page.tsx` | home directory; passes teacher cards to `TeacherDirectory` |
| `app/teacher/[slug]/page.tsx` | profile: header, follow button, WhatsApp, visitor banner, `TeacherTabs` |
| `app/teacher/[slug]/lesson/[lessonId]/page.tsx` | lesson; renders locked panel when gated |
| `app/login/page.tsx` | sign-in for **everyone** (students and teachers): Google OAuth + email magic link |
| `app/auth/callback/route.ts` | exchanges the OAuth/magic-link code for a session |
| `app/auth/signout/route.ts` | POST sign-out |
| `app/dashboard/page.tsx` | **student** dashboard: حصصي / معلّميّ / تقدّمي + "أكمل التعلّم" |
| `app/teacher/join/page.tsx` | teacher signup landing → `/login?role=teacher` |
| `app/teacher/onboarding/page.tsx` | create/edit teacher profile (`TeacherProfileForm` → `saveTeacherProfile` action) |
| `app/teacher/me/page.tsx` | teacher hub: profile summary, stats, share panel, edit, link to content manager |
| `app/teacher/me/content/page.tsx` | content manager: units + lessons + live sessions, with delete forms |
| `app/teacher/me/lessons/new` · `lessons/[lessonId]` | create/edit a recorded lesson (`LessonForm`) |
| `app/teacher/me/live/new` · `live/[sessionId]` | create/edit a live session with pricing (`LiveForm`) |
| `app/dashboard/profile/page.tsx` | student fills their own data (`StudentProfileForm`) |
| `app/teacher/me/students/page.tsx` | teacher's followers: profiles, progress, messages, access grants |
| `app/privacy/page.tsx` · `app/terms/page.tsx` | Arabic legal pages, linked from the footer |

**Teacher accounts** (Supabase Auth, same Google/magic-link as students — there is no separate teacher login): a user is a teacher iff they own a `teachers` row (`owner_id = auth.uid()`). `saveTeacherProfile` (`app/actions/teacher.ts`) creates/updates that row — name, subject, stages, qualification, `experience_years`, bio, whatsapp, avatar (resized data URL in `avatar_url`), auto-generated unique slug (reserved words blocked). `teachers` columns `qualification`, `experience_years`, `is_published` (directory shows published only; RLS: public read = published-or-owner, plus owner INSERT). `getMyTeacher()` / `isCurrentUserTeacher()` drive the navbar and teacher pages.

**One email = one role.** A teacher account and a student account are mutually exclusive, deliberately. `getAccountRole()` returns `visitor` | `new` | `student` | `teacher`:

- `teacher` — owns a `teachers` row.
- `student` — signed in with *activity* (an enrollment, follow, or saved progress).
- `new` — signed in with no activity yet; **this state must stay convertible to teacher**, because it is the normal signup path (sign in → create profile). Do not tighten it to "any signed-in user is a student".

Enforcement is server-side, not just hidden buttons: every action in `app/actions/student.ts` rejects callers who own a `teachers` row, and `saveTeacherProfile` refuses to create a profile for an account with student activity. `/dashboard` redirects teachers to `/teacher/me`; `/teacher/join` and `/teacher/onboarding` send active students to an explanatory page offering sign-out. A teacher viewing their own public profile sees a preview banner and edit links instead of follow/enroll controls.

Both roles sign in through `/login`; `?role=teacher` only switches the copy and the post-login destination. The navbar shows two equally prominent entries (`🎓 دخول الطلاب`, `👩‍🏫 دخول المعلّمين`) — a text link reading "انضم كمعلّم" was confusing returning teachers, since sign-in and sign-up are the same action here.

**Teacher content** lives in Supabase, written by `app/actions/teacher-content.ts`: `createUnit` / `renameUnit` / `deleteUnit`, `saveLesson` / `deleteLesson`, `saveLive` / `deleteLive`. Every action re-resolves the caller's own `teachers` row and scopes each write by `teacher_id`, so a signed-in user can only touch their own curriculum (owner-write RLS from `0002_rls.sql` is the second line of defence — no migration was needed for this feature). Notes:

- `saveLesson` replaces `quiz_questions` wholesale (delete + insert), enforces **one** `is_free_preview` lesson per teacher by clearing the flag on the teacher's other lessons, and sanitizes every section's HTML (see "Rich lesson content").
- `status` is `draft` | `published`; public queries filter `status = 'published'`, so drafts never reach students.
- `VideoPlayer` embeds YouTube links (`youtube-nocookie`, watch/youtu.be/embed/shorts forms) and falls back to a `<video>` element for direct MP4 URLs.

Brand: `public/logo.svg` is a hand-built SVG reconstruction of the platform logo (mortarboard + ring + two figures), used in the navbar, footer, and as favicon/OG icon. `metadataBase` is `https://hissa.sbs` (the live custom domain). Contact email placeholder in the legal pages is `support@hissa.sbs`.

Auth providers: **email magic link works out of the box**; **Google OAuth must be enabled** in Supabase → Authentication → Providers with the callback URL added to redirect URLs. Phone/WhatsApp OTP is deliberately deferred until an SMS provider exists.

### Client vs server components

Server: pages, `NavbarActions` (reads the session directly so there is no signed-in/out flicker), `ConnectionNotice`, `Stars`. Client: `TeacherDirectory` (search/filter), `TeacherTabs` (tabs + locked badges + pricing), `EnrollButton`, `FollowButton`, `CancelEnrollmentButton`, `LessonCompleteButton`, `VideoPlayer`, `QuizSection`, `TeacherProfileForm`, `LessonForm`, `LiveForm`, `AddUnitForm`, `ShareProfile`, `RichTextEditor`.

`ShareProfile` (`components/ShareProfile.tsx`) on `/teacher/me`: the teacher's public profile URL (`window.location.origin + /teacher/<slug>`, so it's correct on any domain), a scannable QR code generated client-side with the `qrcode` package (downloadable PNG), a copy button, and WhatsApp/Telegram share links.

### Removed: the localStorage teacher demo

The old browser-local teacher demo is **gone** — deleted, not deprecated. That covered `/teacher-login` (shared demo password `123456` + teacher picker), `/teacher-dashboard/**` (content designer), `/teacher/[slug]/lesson-draft/[draftId]`, and `lib/useTeacherAuth.ts`, `lib/useLessonDrafts.ts`, `lib/mediaStore.ts`, `lib/useTeacherProfile.ts`, `lib/students.ts`. Teachers now sign in through the normal `/login` and manage real Supabase content at `/teacher/me/content`. Do not reintroduce a separate teacher login.

`lib/teachers.ts` and `scripts/seed.ts` (`npm run seed`) are deliberately **kept** as a dev-only seed source — they are not imported by any page, so they cost nothing in the bundle, and they make the demo directory reproducible on a fresh database.

The six seeded demo teachers were deleted from the live database (their units/lessons/attachments/live sessions cascaded). Real teacher rows are distinguished by `owner_id is not null` — the seed rows had `owner_id is null`, which is the safe discriminator if you ever need to purge seed data again.

### Student profiles, teacher messages, and access grants (`0008`)

**Student data** lives on `profiles` (`grade`, `school`, `city`, `age`, `avatar_url`, `phone`, `whatsapp`, `guardian_phone`, `profile_done`). Only name and grade are required — **the phone numbers are deliberately optional** and the form says so. `saveStudentProfile` (`app/actions/student-profile.ts`) rejects teacher accounts, since the roles are exclusive. A teacher can read a follower's profile only through the `profiles_teacher_reads_followers` policy, which is keyed on `follows` (the older policy keyed on the dead `subscriptions` table and never matched).

**Teacher messages** (`teacher_messages`): `student_id` set = a private note to one student; `student_id null` = broadcast to every follower. Students read them on `/dashboard`; RLS lets a student see only messages addressed to them or broadcasts from teachers they actually follow. Bodies are `stripTags`-ed — they render as plain text, never HTML.

**Access grants** (`student_grants` + `lessons.is_restricted` / `live_sessions.is_restricted`): a teacher marks a lesson or session "خاص", then grants specific followers access from `/teacher/me/students`. A grant row with both `lesson_id` and `session_id` null means "all of this teacher's restricted content".

Enforcement is in the `lessons` / `live_sessions` SELECT policies via the `security definer` helper `has_grant()`: a restricted row is **hidden entirely** from anyone without a grant — title included. RLS filters rows, not columns, so full-row hiding is the only real guarantee here; there is no "locked but visible" state for restricted content (unlike the visitor gate, which hides columns). Consequence: lesson counts legitimately differ per student.

## Conventions

- Path alias `@/*` maps to the repository root (see `tsconfig.json`).
- Arabic-Indic numerals (٩٠ دقيقة) appear inside data strings; UI-computed numbers render as Latin digits.
- **PWA**: `public/manifest.webmanifest`, generated icons (`icon-*.png`, `apple-touch-icon.png`), and `public/sw.js`, registered by `components/ServiceWorker.tsx`. `components/InstallApp.tsx` shows an install button on Android/Chrome via `beforeinstallprompt`, and an "add to home screen" hint on iOS Safari (which has no such event); it hides itself when already installed or dismissed. **The service worker never caches HTML** — pages depend on auth state, so a cached page could show one account's data to another on a shared device. Only `/_next/static/` and other user-data-free assets are cached, plus `offline.html`.
- Styling lives entirely in `app/globals.css` (plain CSS + custom properties, no Tailwind/CSS modules). Mobile breakpoint is 720px.
- Placeholder media is CSS-only (gradients + initials/emoji). Lesson videos are Google's public sample MP4s; attachments point at three real PDFs in `public/files/`.
