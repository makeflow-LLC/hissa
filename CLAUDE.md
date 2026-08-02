# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

"منصة حصة" (Hissa Platform) is an Arabic-language, RTL digital-school platform built with Next.js and Supabase. Students browse a searchable teacher directory; each teacher profile offers a curriculum of recorded lessons organized into units, with rich formatted explanations, quizzes and attachments.

**Business model:** the platform is **free for everyone today** — free for students, free for teachers, and **no payments flow through it at all**. Any money that changes hands is arranged directly between student and teacher outside the platform; the app records nothing about it. Paid subscriptions are a deliberate "later", not an oversight.

**Access tiers:**

| | Visitor (not signed in) | Signed-in student |
|---|---|---|
| Directory, search, filter, any profile | ✅ | ✅ |
| Lesson titles + descriptions | ✅ | ✅ |
| Full lesson content (video, explanation, gallery) | ❌ — except the one lesson flagged `is_free_preview` per teacher | ✅ all lessons |
| Attachments, quizzes | ❌ | ✅ |
| Request to join a teacher, save progress, review a teacher | ❌ | ✅ |

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

Live project ref `mexpmtuqhvnphgeqqjuf`, region `eu-central-1`, URL `https://mexpmtuqhvnphgeqqjuf.supabase.co`. Schema and RLS are applied; the demo teachers were deleted, so the directory starts empty.

**`.env.local` is optional for running the app**: the project URL and publishable (anon) key are baked into `lib/supabase/config.ts` as defaults — they are public by design (sent to every browser); RLS is the security boundary. Env vars, when present, override the defaults. The one secret that must live only in `.env.local` (never commit — `.gitignore` covers `.env*`; template in `.env.example`):

```bash
SUPABASE_SERVICE_ROLE_KEY=<secret key>   # npm run seed only — never NEXT_PUBLIC_
```

> **Sandbox note:** this environment's network policy blocks `*.supabase.co`, so `npm run seed` and any runtime query fail here with "Host not in allowlist". Schema/data changes from inside a session must go through the Supabase MCP tools. Pages degrade to a server-rendered `ConnectionNotice` instead of crashing, so `npm run build` and route smoke tests still work offline.

### Tables

In use: `teachers`, `units`, `lessons`, `lesson_attachments`, `quiz_questions`, `profiles`, `follows`, `lesson_progress`, `teacher_messages`, `student_grants`, `reviews`, `parent_reports`, `student_groups`, `student_group_members`, `report_cards`, `report_card_requests`, `exams` (+ `exam_questions` / `exam_attempts` / `exam_answers` / `exam_templates`), `activities` (+ `activity_plays` / `activity_templates`).

- `lessons.is_free_preview` — the one visitor-visible lesson per teacher.
- `lessons.is_restricted` — hidden entirely unless the student holds a `student_grants` row.
- `lesson_progress` — one row per completed lesson.
- `follows` is what "تابع هذا المعلم" writes, and is the basis for "my students".

Dead, kept only to avoid a destructive drop: `subscriptions` (superseded by `follows`), and `live_sessions` / `enrollments` (see "Removed: live sessions").

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
| `0009_reviews_and_parent_reports.sql` | real `reviews` (+ rating trigger) and `parent_reports` |
| `0010_attachments_and_quiz_attempts.sql` | widen attachment kinds + bucket MIME types, `quiz_attempts` |
| `0011_two_way_messaging.sql` | `teacher_messages.sender` + student insert/delete policies |
| `0012_ai_usage_quota.sql` | `ai_usage` ledger enforcing a monthly per-teacher cap |
| `0013_groups_report_cards_join_requests.sql` | join requests on `follows`, `student_groups`, `report_cards`, `normalize_ar()` + one-teacher-per-subject trigger |
| `0014_follow_vs_join.sql` | `following` status separating follow from join; review requires an approved join |
| `0015_report_card_requests_and_realtime.sql` | `report_card_requests` + realtime publication for messages, follows and cards |
| `0016_exams.sql` | group-targeted `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `get_exam_paper()` + server-side grading functions |
| `0017_group_hub_messaging_availability.sql` | group `whatsapp_link`/`goal`/`schedule`, `teacher_messages.group_id`, `message_dismissals`, `teachers.availability` |
| `0018_exam_templates.sql` | `exam_templates` — a teacher's reusable exam structure, stored as `jsonb` |
| `0019_exam_target_points.sql` | `exams.target_points` — the teacher's intended total, compared against the questions' sum |
| `0020_activities.sql` | `activities` / `activity_plays` / `activity_templates` — Wordwall-style games over one shared item list |
| `0021_more_activity_kinds.sql` | four more game kinds (10 total), `activities.show_leaderboard` + `activity_leaderboard()` |
| `0022_teacher_overrides_auto_mark.sql` | `recalc_attempt_score` rebuilds `auto_score` too, so a teacher can correct an auto-graded mark |

### Removed: live sessions

Live sessions and paid enrollment were **removed from the product** — there is no way to create, browse, or enroll in one, and no pricing anywhere. Payment, when it happens, is arranged directly between student and teacher outside the platform; the app deliberately holds no record of it and offers no "confirm payment" step.

The `live_sessions` and `enrollments` tables are **left in place, unused and unreferenced** (both were empty at removal). Nothing reads or writes them. Delete them only if you are sure the feature will not return.

### Ratings are real, never seeded

`teachers.rating` / `rating_count` are **derived columns** maintained by the `reviews_recalc` trigger — never write them by hand. A teacher with no reviews shows `0/0`, and every surface renders "معلّم جديد" / "لا تقييمات بعد" instead of stars. The earlier code wrote a hardcoded `5.0` at profile creation, which made every teacher look identically perfect; do not reintroduce that.

Eligibility to review is enforced **in RLS, not just the UI**: `reviews_student_write` requires an approved `follows` row for that teacher (see "Following and joining"). So only a student the teacher accepted into the class can rate them, and nobody can post under another student's id. One review per (teacher, student), editable.

### Following and joining are two different things

They are separate actions on the teacher's page, not one:

| | متابعة (follow) | انضمام (join) |
|---|---|---|
| Takes effect | instantly | only after the teacher approves |
| Grants messages, groups, report cards, restricted content | ❌ | ✅ |
| May review the teacher | ❌ | ✅ |
| Limited to one teacher per subject | ❌ follow as many as you like | ✅ |

Both live in the same `follows.status` column rather than a second table, so every existing `status = 'approved'` check stayed correct when follow was added. The ladder is `following` → `pending` → `approved` / `rejected`; a rejected student stays a follower.

**The join request carries no message from the student.** The direction is the opposite: the teacher writes `teachers.join_instructions` **in advance** in their profile (conditions, class times, what to bring), the student reads them and confirms. Adding a student-written note back would invite a second inbox nobody reads.

**A pending request grants nothing.** Everything keyed on `follows` requires `status = 'approved'`: broadcasts, two-way messages, group membership, report cards. The one deliberate exception is `profiles_teacher_reads_followers`, which also matches `pending` — the teacher needs the applicant's name and grade to decide, and the student is the one who applied to that teacher.

**Only a joined student may review.** `reviews_student_write` requires an approved `follows` row. It used to require a single `lesson_progress` row, which was far too weak a signal — any signed-in student could open a lesson, tick it complete and rate. Being accepted into the class is the teacher's own decision, so it is the stronger evidence that real teaching happened.

Existing rows were backfilled as `approved` (the column default was `'approved'` during the `add column`, then switched to `'pending'`), so nobody following a teacher before the migration was dropped back into a queue.

### One teacher per subject

A student may **join** only one teacher of a given subject — no two maths teachers at once. Following is unrestricted; the rule fires only for `pending` and `approved`. Enforced by the `follows_one_teacher_per_subject` trigger, **not** by the UI: hiding a button does not stop a request posted straight at the REST API. The error surfaces as `ONE_TEACHER_PER_SUBJECT:<other teacher's name>`, which `requestJoin` translates into an Arabic sentence naming that teacher.

Subjects are compared through `normalize_ar()` (SQL) — diacritics, tatweel, alef forms, ة/ى, **and the definite article** all folded — so «الرياضيّات» and «رياضيات» are one subject. `normalizeSubject()` in `lib/arabic.ts` mirrors it exactly so the profile page can explain the clash before the student clicks; **if you change one, change the other**, or the UI will offer a button the database refuses. A rejected request does not reserve the subject.

### Groups and report cards

`student_groups` + `student_group_members` let a teacher sort students into groups (a student may be in several). `report_cards` are end-of-unit or end-of-term evaluations: four 0–5 ratings (understanding, participation, homework, behaviour), an optional score, strengths, improvements and a note. Students read their own cards on `/dashboard`.

Both are teacher-owned and student-readable, and both refuse to reference a student who is not `approved`. The two group policies once referenced each other and sent RLS into infinite recursion; `is_group_member()` (`security definer`) breaks the cycle on one side, the same way `has_grant()` does in `0008`.

### A student's page, and where marks are not shown

`getStudentForTeacher()` backs `/teacher/me/students/[studentId]` — one batched read of everything a teacher knows about one student. It resolves the student through an **approved** `follows` row for the caller's own teacher id and returns `null` otherwise, so passing a stranger's id opens nothing.

It exists because the roster had grown into a wall: every student's card carried the report-card form, the grant panel, the group chips and the message thread at once. The list is now a list; the detail opens when it is wanted. Every place a student's name appears — roster, group members, grading board, card requests — links here.

**Marks are shown wherever the person they belong to would look for them.** A student's own board prints "نتيجتك ٦ من ٦" on each exam card, with "إجاباتي" opening the per-question breakdown. The teacher's hub carries a **latest results** list (`getRecentExamResults`) — student, exam, mark, and a "صحّح" link when a text answer is still pending — and the group hub shows each member's exam average. Marks were briefly hidden from both boards; that was reverted, because a result the student has to hunt for is a result they assume was never given.

### The group hub (`/teacher/me/groups/[groupId]`)

A group used to be a label pinned on a student and nothing more. `0017` turns it into a class with its own page: members with their lesson progress, their average across **this group's** exams, their latest report card, and an "awaiting your reply" flag when the last message in the thread came from them; a broadcast that reaches only its members; a WhatsApp invite link; a goal and a meeting time; the group's exams; and bulk access to restricted lessons.

Three things exist only through a group, and this page is where they meet: an **exam** targets exactly one group, the teacher's **WhatsApp number** is shown only to members, and a **restricted lesson** can be granted to the whole group in one click.

`getGroupHub()` is one batched query rather than several page-level calls — the route is `force-dynamic`, so each call would be another round trip on every visit. It resolves the group by `id` **and** `teacher_id`, so passing a stranger's group id opens nothing.

**"A private lesson for the group" is not a new kind of lesson.** `setGroupLessonAccess` writes one `student_grants` row per member of an `is_restricted` lesson, so it rides the same policy the lesson table already enforces — no second permissions path to disagree with the first. It inserts only the missing rows: the unique index on `student_grants` is built on `coalesce(...)` expressions, which PostgREST's `onConflict` cannot name.

### Three message destinations, two columns

`teacher_messages` distinguishes them by which columns are set, not by separate tables:

| Columns set | Destination |
|---|---|
| `student_id` | one student — a two-way thread |
| `group_id` | that group's members only |
| neither | every follower |

A student may **remove** a message from their own list. Deleting the row is only correct for a message the student wrote; a broadcast is a single row read by twenty students, so deleting it would erase it for the whole class. `dismissMessage` therefore deletes their own message but writes a `message_dismissals` row for anyone else's, and `getMyMessages` filters those out in JS. Students can also reply to any teacher message inline (`MessageActions` → `askTeacher`).

### The teacher's availability

`teachers.availability` is `available` | `busy` | `offline`, plus a free-text `availability_note`, set by the teacher from their hub and rendered on their public profile. It is **manual, never derived from last-seen**: "online 3 minutes ago" reports when someone opened a page, not when they intend to reply, and it exposes a teacher's habits to people who have no business knowing them.

### Help: `/help`, and hints behind an icon

`/help` is a two-tab Q&A (student / teacher) with collapsed answers; the tab opens on the reader's own role via `getAccountRole()`, and `?role=` overrides it. It is public and in the sitemap.

`Hint` no longer prints its paragraph unconditionally — it renders a small "؟ ما هذا؟" button that expands on click, and `InfoTip` is the inline variant that sits beside a field label. Every existing `<Hint>` became collapsible with no call-site change. Neither uses `title=` or hover: this audience is overwhelmingly on phones, where there is no hover.

### Live notifications

`LiveNotifier` (mounted in the root layout via `LiveNotifierMount`, so it runs on **every** page — it used to sit on the two dashboards only, and a teacher editing a lesson or grading an exam got nothing) subscribes to `teacher_messages`, `follows`, `report_cards` and `report_card_requests` via Supabase Realtime, shows a toast, plays a two-note Web Audio chime, and debounces a `router.refresh()`. No filters are set on the channel — **RLS is the filter**, so a subscriber only ever receives rows it may already read.

Three deliberate details:

- **No audio file.** The chime is generated with oscillators; browsers block audio before the first user gesture, so the `AudioContext` is created lazily on the first `pointerdown`/`keydown`. If it stays blocked, the visual toast still appears.
- **A system notification only when the tab is hidden**, and only after the user grants permission from the button the component renders. Duplicating a toast that is already on screen is noise.
- **A polling fallback.** School networks frequently block WebSockets — exactly our audience. If the channel reports `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`, or simply never subscribes within 10s, a 20-second poll of the newest message takes over. Without it the feature would die silently on the networks that need it most.

### Students may request a report card

`report_card_requests` lets a joined student ask for an evaluation instead of waiting for the teacher to volunteer one. The request carries **no text** — same reasoning as join requests: the teacher decides the unit, term and ratings when issuing. A partial unique index allows only one `pending` request per (teacher, student), and issuing a new card auto-closes the pending request so it does not linger on the teacher's board.

### Exams

A teacher writes an exam, points it at **one group**, and only that group's members ever see it. Distinct from `quiz_questions` (which belong to a lesson): an exam is standalone, has an open/close window and an optional per-attempt duration, and carries a mark per question. Three question kinds: `mcq`, `truefalse`, `text`.

**The correct answers are never sent to the student.** RLS filters rows, not columns, and column privileges distinguish `anon` from `authenticated` — not student from teacher, since both are `authenticated`. So `exam_questions` grants the student nothing at all; the only way in is the `security definer` function `get_exam_paper(exam_id)`, which returns the questions with `correct_index`, `correct_bool` and `model_answer` stripped, and only when `can_take_exam()` or `owns_exam()` holds. **Do not add a student SELECT policy on `exam_questions`** — one would hand every student a perfect score through the REST API.

**Grading runs in the database**, not the browser: `grade_exam_attempt(attempt, payload)` reads the correct answers itself, so the client only ever posts its choices. It refuses an attempt that is not the caller's own or is no longer `in_progress`, which is what stops re-submitting for a better mark. An attempt lands in `submitted` when any text question exists (waiting on the teacher) and `graded` otherwise; `recalc_attempt_score` re-totals after each manual mark and flips to `graded` once nothing is pending. Verified by role-switching SQL: a non-member sees zero exams/questions/paper rows and cannot insert an attempt; a member reads 3 paper questions but 0 rows from `exam_questions`; and a student updating their own `awarded` or `manual_score` changes 0 rows.

**Templates and duplication.** Three routes to a new exam, cheapest first: **built-in templates** (`lib/examTemplates.ts` — 5 structures: quick MCQ, true/false, mixed unit, essay, end-of-term), the teacher's **saved templates** (`exam_templates`, RLS owner-only), and **duplicating** an existing exam. Two decisions:

- **A template is structure, not content** — question count, kinds and marks, with prompts left empty. Subject and stage vary too much for a canned question to be anything but naive; what actually costs the teacher time is setting kind and marks per question. `parseTemplateQuestions` is therefore laxer than `parseQuestions` in exactly one way: it does not require a prompt.
- **Templates apply in the editor, never straight to the database**, so a teacher who picks the wrong one loses nothing. `duplicateExam` is the opposite — a real row — and it always lands as a **draft** even when the source is published, because a copy reaching students before the teacher reviews it is worse than none.

**The answer key is never assumed.** `correct_index` and `correct_bool` start as `null` — in `ExamBuilder`, in `parseQuestions`, in `parseTemplateQuestions`, and in the built-in templates — and saving is refused until the teacher picks, with a message naming the question number. Both ends used to default silently (`Number(o.correct_index ?? 0)` and `o.correct_bool === true`), so an exam whose key was never chosen was published keyed to **the first option / «صح»**: the student answered wrongly, scored full marks, and neither side could see why. Do not reintroduce a default here — a wrong key is invisible, unlike a missing one.

**Dropping an empty option must move the key with it.** `ExamBuilder` filters blank options out of the payload, and it now remaps `correct_index` through the surviving indices. Sending the raw index meant options `[أ, (فارغ), ج, د]` with «ج» ticked arrived as `[أ, ج, د]` with index 2 — pointing at «د». The teacher never touched the key and it still changed.

**A teacher can override an auto-graded mark.** Auto-grading never miscounts, but it grades against the *stored* key — so a wrong key produces a wrong mark that is perfectly consistent with the rules, and questions lock the moment a student starts. `GradingBoard` therefore offers «صوّب العلامة» on `mcq`/`truefalse` answers too, and `0022` widens `recalc_attempt_score` to rebuild **both** `auto_score` and `manual_score` from `exam_answers`; before it, only `text` answers were summed, so overriding an MCQ changed the row and left the total untouched — worse than refusing the edit.

**Every question shows the mark it earned**, on the teacher's board and the student's review alike (`.answer-mark`, coloured full / partial / zero / pending). The prompt used to carry only the question's price («٢ علامة»), which says nothing about whether it was right or where the total came from. The student's review still never reveals the correct answer — the paper reaches them stripped of it.

**Questions lock once anyone starts.** `saveExamQuestions` replaces the set wholesale, so editing after answers exist would silently re-grade them against different questions; `ExamBuilder` renders read-only instead and asks the teacher to create a new exam.

**The time window is enforced server-side** in `submitExam` — the window itself, plus `duration_minutes` measured from `started_at` with a two-minute grace for slow networks. The countdown in `ExamTaker` is a courtesy, and a student can stop it from devtools. One deliberate asymmetry: the countdown auto-submits when it reaches zero **while the page is open**, but a student who returns to an already-expired attempt is *not* auto-submitted — posting a blank paper on their behalf would burn their only attempt.

**The window is submitted as an absolute instant, computed in the browser.** A `datetime-local` field yields `2026-08-01T11:35` with no zone, and whoever parses it assumes their own — so the UTC server stored 11:35Z for a teacher who meant 11:35 in Gaza (UTC+3), and the browser then displayed it back as 14:35. Every save shifted it again. `ExamForm` now sends hidden ISO fields it computes itself, and `when()` **rejects any string without a zone** so the old shape cannot silently return. Times render through `ExamWindow`, a client component, for the same reason.

**A total the teacher declares, checked against the questions.** `exams.target_points` is optional; when set, `ExamBuilder` compares it to the live sum on every keystroke and `setExamStatus` refuses to publish on a mismatch — with the numbers in the message and a "publish anyway" button, since the teacher may have changed their mind about the total. It is never used for grading: `grade_exam_attempt` always sums `exam_questions` itself. `⚖️ وزّع بالتساوي` divides the target across the questions, putting the remainder on the last one so the sum lands exactly.

### Interactive activities: one content set, ten games

`activities` is the Wordwall idea: the teacher enters **pairs** once — `items` is `[{a, b}]` — and `kind` decides how they are played. Switching the kind never touches the content, which is the whole point; the meaning of `a` and `b` is what differs (`lib/activityKinds.ts` carries the label, per-column headings, minimum item count, whether it is scored, an example row, and the explanation per kind).

Ten kinds: `match` · `flashcards` · `quiz` · `anagram` · `sort` · `memory` · `truefalse` · `balloons` · `speed` · `wheel`. Each is one file under `components/games/`, and `ActivityPlayer` is the shell that dispatches and records. A game's only outlet is `onFinish(score, total)` — it knows nothing about the database, so an eleventh kind is one file, one line in the dispatch, one entry in `KINDS`, and one widened `check` constraint. `readKind()` in `app/actions/activities.ts` derives from `KINDS`, so a new kind cannot be silently rejected by the server action.

**An activity is practice, not assessment — and the design says so out loud.** Unlike `exams`, the answers are *sent to the browser*: a match-up cannot be played without the student seeing both sides, so hiding them is impossible rather than merely inconvenient. The score is therefore computed client-side and stored for encouragement only; it never enters a real average, the UI tells the student that, and `recordPlay` clamps the numbers. Anything needing a protected mark belongs in `exams`.

Two smaller decisions: `group_id` is **nullable** (null = every approved student, unlike exams which always target one group) because practice loses nothing by being wider; and `quiz`, `balloons` and `speed` all build their wrong answers from other items' `b`, so the teacher writes one question and one answer per row and no distractors ever.

Templates mirror the exam ones exactly — built-in structures, `activity_templates` for the teacher's own, and `duplicateActivity` which always lands as a draft.

**Scoring is per-game and deliberately forgiving**, because the point is repetition rather than ranking:

- `memory` grants **`n` free misses** (one per pair). A memory game starts in necessary ignorance — the only way to learn what a card hides is to turn it — so charging for the first pass made a flawless player finish on half marks and read as unfair. Beyond that, one point per two extra misses.
- `speed` scores **correct out of what was shown**, not out of the item list: someone who answered 12 of 14 in sixty seconds beat someone who answered 6 of 6 slowly, and dividing by the item count would have tied them. Its streak counter is for encouragement and never multiplies the score. Because the total varies per play, the leaderboard must take best *and* total from **one row** — see below.
- `truefalse` writes its own false statements by pairing one item's `a` with another's `b`, so the teacher never types a wrong answer.

**The leaderboard is opt-out per activity.** `activities.show_leaderboard` (default true) gates `activity_leaderboard(a_id, top)`, a `security definer` function returning each student's best result. It has to be `security definer`: the `activity_plays` policy correctly limits a student to their own plays, and opening the table for a ranking would be the wrong trade. The function refuses unless `can_play_activity()` or `owns_activity()` holds *and* the teacher left the board on. Competition drives repetition and repetition is the practice — but a struggling student seeing their name last every time is a reason to leave, so the switch is the teacher's.

It selects with `distinct on (student_id)` ordered by ratio, **not `max(score)` with `max(total)`**: those two aggregates come from different rows, so a student who scored 9/10 and later 4/30 in `speed` was shown "9 من 30" — a result that never happened.

**`/teacher/me/activities/guide` explains the feature by letting the teacher play it.** Six steps, then `ActivityDemo` — a chip row over `ActivityPlayer` in `preview` mode with sample content from `lib/activityDemos.ts`. Prose cannot convey what a game feels like, and no teacher will build a whole activity just to see a kind they have not tried. The demo content is deliberately **general knowledge**, not one subject, so a maths teacher does not read the games as "for Arabic".

### The teacher's WhatsApp is not public

`teachers.whatsapp` renders only for a student who is a **member of one of that teacher's groups** (or for the teacher previewing their own page). Publishing it on a public profile turns the directory into a phone-number source for any visitor or scraper. Group membership is the teacher's own decision, so it doubles as the consent signal.

### Parent reports

`parent_reports` lets a teacher send a periodic report about a student to that student's **guardian**, who has no account on the platform. The report is stored (the student sees it on `/dashboard`) and `ParentReportForm` builds a prefilled WhatsApp message to `profiles.guardian_phone` — a one-tap send, no messaging infrastructure required. If the student left the guardian number blank the form says so instead of offering a dead button.

### Attachments and quiz results

Both were dead UI until `0010`. The lesson page had always rendered a "📎 المرفقات" section and a quiz, but no teacher could upload a file and no answer was ever stored.

**Attachments** upload from the browser to the same `lesson-media` bucket (`0010` widens its MIME list to documents and raises the limit to 20 MB); `addAttachment` then records the row after re-checking the lesson belongs to the caller. `AttachmentManager` only appears when editing an existing lesson — a new lesson has no id to attach to yet, and the form says so.

**Quiz attempts** are stored one row per (lesson, student), updated on retry. **The grading happens on the server** (`app/actions/quiz.ts`): the client sends only its choices and the action reads `correct_index` from the database. Grading in the browser and trusting a posted score would let any student submit a perfect result. A teacher reads a student's quiz scores on that student's own page.

### Arabic search

`lib/arabic.ts` normalizes before comparing: strips diacritics and tatweel, folds all alef forms to `ا`, `ى`→`ي`, `ة`→`ه`, hamza carriers to `ي`, Arabic-Indic digits to Latin, and punctuation to spaces. Without it "احمد" never matched "أحمد" — an everyday failure in Arabic, not an edge case. `matchesQuery` requires every query word to appear, so "احمد رياضيات" matches even when the words are far apart.

Each `TeacherCard` carries a prebuilt `searchText` (name + subject + bio + qualification + stages + **lesson titles**), so a student can find a teacher by the topic of a lesson, not just by name.

### Ordering and SEO

Units and lessons carry a `position`, but it is a counter set at creation, so gaps and ties appear after deletes. `moveUnit` / `moveLesson` therefore sort the current siblings, swap two entries, then **rewrite the whole list as 0..n** — the order self-normalizes on every move instead of drifting. Lessons only reorder within their own unit; moving a lesson between units is the unit dropdown in the lesson form.

`app/sitemap.ts` and `app/robots.ts` expose the public surface: the directory, every published teacher, and every published non-restricted lesson. Personal pages (`/dashboard`, `/teacher/me`, `/login`, `/auth/`) are disallowed — a crawler only ever sees a redirect there. The sitemap fails closed: on a connection error it returns the static pages rather than throwing, so one outage cannot empty the whole sitemap. Teacher and lesson pages carry real descriptions, canonical URLs, OpenGraph tags, and JSON-LD (`Person` with `aggregateRating` when reviews exist; `LearningResource` for lessons). Routes stay `force-dynamic` — that is fine for indexing, since titles and descriptions are public and only the gated content is withheld.

### AI assistance (teacher-only)

`lib/ai/openrouter.ts` + `lib/ai/prompts.ts` + `app/actions/ai.ts` power three teacher tools inside the lesson form: **summarize the lesson**, **suggest quiz questions**, and **improve a section's formatting**. Model is OpenRouter's `google/gemini-3.1-pro-preview` (override with `OPENROUTER_MODEL`).

Non-negotiables baked into the design:

- **The key is server-only.** `OPENROUTER_API_KEY` never gets a `NEXT_PUBLIC_` prefix, and both AI modules import `server-only` so a client-component import fails the build rather than shipping the key.
- **The model suggests, never publishes.** Every result lands in the editor for the teacher to review and edit before saving. A wrong fact published under a teacher's name damages them.
- **Output is untrusted input.** Generated HTML goes through `sanitizeLessonHtml` exactly like teacher-typed HTML; quiz JSON is re-validated field by field (`correct_index` must be in range) before it reaches the form.
- **There is a hard monthly cap** (`MONTHLY_LIMIT` in `app/actions/ai.ts`, 40). Teacher signup is open to anyone and the platform has no revenue, so an uncapped endpoint is an open invitation to drain the balance.

**Summarizing a PDF: the file goes to the model, its text does not.** A teacher can upload the lesson as a PDF and get a summary of it. The obvious implementation — extract the text with pdf.js and summarize that — is **wrong for Arabic**: extraction returns Arabic Presentation Forms in *visual* order, so «الدرس الثالث: قانون أوم» comes back as «أوم نﻮﻧﺎﻗ :ﺚﻟﺎﺜﻟا رسﺪﻟا». NFKC repairs the letter forms but not the order, and reversing the line breaks the runs that were already logical («موأ» for «أوم»). Summarizing that is summarizing gibberish. So the PDF is sent to the model itself (OpenRouter's `file-parser` plugin, `native` engine) — verified end-to-end against the live API, including an **image-only scanned** PDF, which is the common case for school material here and which no text extractor can read at all.

`unpdf` is kept for exactly two things: proving the upload really is a PDF, and counting pages so a whole textbook is refused before any money is spent (`MAX_PDF_PAGES` = 30). Measured cost is ~$0.02 per one-page summary, dominated by the model's reasoning tokens rather than the pages.

The file is uploaded by the **browser** to `lesson-media/<auth.uid()>/…` — the same bucket and policy as attachments — and only its *path* reaches the server action; several megabytes through a Server Action exceeds the body limit and fails on a weak network. The action re-checks that the path's first segment is the caller's own id, since the bucket is public-read and a path alone would otherwise open another teacher's file. The temporary upload is deleted once the summary returns.

Prompts inject the teacher's own `subject` and `stages`, so wording targets the right level (a primary pupil and a secondary student get different registers). The allowed-tag list in `prompts.ts` deliberately mirrors the sanitizer's allowlist — asking for tags that would be stripped produces silently truncated output. Teachers can add free-text توصيات that are appended to the request.

Gemini 3.1 Pro is a reasoning model: reasoning tokens count against `max_tokens`, hence the generous 8000 default. Measured cost is roughly $0.04 per summary and $0.036 per quiz, so the 40-call cap bounds a single teacher at well under $2/month.

**The tools read the editor, not the database.** `loadLessonContext` takes an optional `draft` (`{html, title}`) that the form supplies from its live state, so a teacher can summarize or format text they just typed and have not saved. Requiring a save first meant saving the very text you know needs fixing. `lessonId` is optional too, so the tools work on a brand-new lesson that has no row yet; the saved sections are only a fallback when the editor is empty.

The whole feature is optional: with no `OPENROUTER_API_KEY` set, `isAiConfigured()` returns false and the buttons simply do not render.

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
- **`app/actions/student.ts`** — student server actions: `toggleFollow` (instant), `requestJoin` / `cancelJoin` (approval), `toggleLessonComplete`. Each re-validates auth server-side, rejects teacher accounts, and calls `revalidatePath`. Reviews live in `app/actions/review.ts`.

### Routes

| Route | Notes |
|---|---|
| `app/page.tsx` | home directory; passes teacher cards to `TeacherDirectory` |
| `app/teacher/[slug]/page.tsx` | profile: header, follow button, WhatsApp, visitor banner, `TeacherTabs` |
| `app/teacher/[slug]/lesson/[lessonId]/page.tsx` | lesson; renders locked panel when gated |
| `app/login/page.tsx` | sign-in for **everyone** (students and teachers): Google account only |
| `app/auth/callback/route.ts` | exchanges the Google OAuth code for a session |
| `app/auth/signout/route.ts` | POST sign-out |
| `app/dashboard/page.tsx` | **student** dashboard: حصصي / معلّميّ / تقدّمي + "أكمل التعلّم" |
| `app/teacher/join/page.tsx` | teacher signup landing → `/login?role=teacher` |
| `app/teacher/onboarding/page.tsx` | create/edit teacher profile (`TeacherProfileForm` → `saveTeacherProfile` action) |
| `app/teacher/me/page.tsx` | teacher hub: profile summary, stats, share panel, edit, link to content manager |
| `app/teacher/me/content/page.tsx` | content manager: units + lessons, with delete forms |
| `app/teacher/me/lessons/new` · `lessons/[lessonId]` | create/edit a recorded lesson (`LessonForm`) |
| `app/dashboard/profile/page.tsx` | student fills their own data (`StudentProfileForm`) |
| `app/teacher/me/students/page.tsx` | roster: one clickable row per student, plus join/card requests, groups and the all-students broadcast |
| `app/teacher/me/students/[studentId]/page.tsx` | one student's whole record: contacts, progress, exam and quiz results, the message thread, groups, grants, report cards |
| `app/teacher/me/groups/[groupId]/page.tsx` | one group as a class: members + progress + exam averages, group broadcast, WhatsApp link, group exams, bulk lesson access |
| `app/help/page.tsx` | Arabic usage guide, two tabs (student / teacher), public and indexed |
| `app/teacher/me/exams/page.tsx` | teacher's exam list, with a "بانتظار تصحيحك" count per exam |
| `app/teacher/me/exams/new` · `exams/[examId]` | create exam metadata (`ExamForm`) → write questions (`ExamBuilder`) + publish (`ExamPublishBar`) |
| `app/teacher/me/exams/[examId]/grade/page.tsx` | results + manual grading of text answers (`GradingBoard`) |
| `app/exam/[examId]/page.tsx` | student takes the exam (`ExamTaker`), or reviews their answers and score once submitted |
| `app/teacher/me/activities/page.tsx` | interactive activities list, with duplicate and delete |
| `app/teacher/me/activities/new` · `activities/[activityId]` | build an activity (`ActivityBuilder`), preview it as a student sees it, publish, and read who played + the leaderboard |
| `app/teacher/me/activities/guide/page.tsx` | how to build an activity: six steps plus a playable demo of all ten games (`ActivityDemo`) |
| `app/activity/[activityId]/page.tsx` | student plays the activity (`ActivityPlayer`) and sees the leaderboard when the teacher left it on |
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
- `app/actions/exams.ts` holds both sides of the exam: `saveExam` / `saveExamQuestions` / `setExamStatus` / `deleteExam` for the teacher, `startExam` / `submitExam` for the student, and `gradeAnswer` for manual marks. Every teacher action re-resolves the caller's own `teachers` row and scopes the write by it; `gradeAnswer` clamps the mark to the question's own `points` before writing.
- `app/actions/teacher-students.ts` covers the teacher↔student side: `sendMessage` (one student, one group, or all followers), `grantAccess` / `revokeAccess`, `setGroupLessonAccess` (a whole group at once), `saveParentReport` / `deleteParentReport`. Every one re-checks that the target actually follows this teacher, and that the group is this teacher's own.
- `status` is `draft` | `published`; public queries filter `status = 'published'`, so drafts never reach students.
- `VideoPlayer` embeds YouTube links (`youtube-nocookie`, watch/youtu.be/embed/shorts forms) and falls back to a `<video>` element for direct MP4 URLs.

Brand: `public/logo.svg` is a hand-built SVG reconstruction of the platform logo (mortarboard + ring + two figures), used in the navbar, footer, and as favicon/OG icon. `metadataBase` is `https://hissa.sbs` (the live custom domain). Contact email placeholder in the legal pages is `support@hissa.sbs`.

**Sign-in is Google-only.** The email magic link was removed deliberately: its links kept opening in a different browser than the one that requested them (a mail app's in-app webview, or the default browser when the request came from the installed PWA), and PKCE stores `code_verifier` in a cookie belonging to the *requesting* browser — so those opens failed with "PKCE code verifier not found in storage". Google OAuth completes the whole round trip in one browser, so that failure mode is gone along with the `/auth/confirm` route and the `token_hash` branch of `/auth/callback`.

**Google OAuth must therefore be enabled** in Supabase → Authentication → Providers, with the callback URL in the redirect list — there is no fallback sign-in if it is off, and the login page says so. Phone/WhatsApp OTP stays deferred until an SMS provider exists. Re-adding email sign-in means restoring `signInWithOtp` plus a `verifyOtp({token_hash})` route; do not re-add the PKCE-only `?code=` form for emailed links.

### Navigation shell

Two pieces carry navigation, and both exist because a back link at the top of a long page disappears the moment you scroll:

- **`BottomNav`** (server, picks items by role) → **`BottomNavBar`** (client, highlights the active tab from `usePathname`). Fixed to the bottom **on mobile only** (≤720px) — on desktop the sticky top bar is always visible anyway. Three to four items maximum; more turns a shortcut into a menu. `body` gets matching bottom padding, and `env(safe-area-inset-bottom)` keeps it clear of the iPhone home indicator.
- **`PageHeader`** — one component for every sub-page: a round back button with an explicit `backHref` (never relying on the browser's back), the parent's name above the title, then title, subtitle and actions. Before it, each page drew its own back link with a different label and position.

### Client vs server components

Server: pages, `NavbarActions` (reads the session directly so there is no signed-in/out flicker), `ConnectionNotice`, `Stars`. Client: `TeacherDirectory` (search/filter), `TeacherTabs` (tabs + locked badges + pricing), `EnrollButton`, `FollowButton`, `CancelEnrollmentButton`, `LessonCompleteButton`, `VideoPlayer`, `QuizSection`, `TeacherProfileForm`, `LessonForm`, `LiveForm`, `AddUnitForm`, `ShareProfile`, `RichTextEditor`, `ExamForm`, `ExamBuilder`, `ExamPublishBar`, `ExamTaker`, `GradingBoard`, `ExamWindow`, `ExamCountdown`, `ActivityBuilder`, `ActivityPlayer`, `ActivityDemo`, `ActivityPublishBar`, `ActivityRowActions`, the ten `components/games/*` (+ `useGameSound`), `Hint`, `InfoTip`, `HelpTabs`, `AvailabilityToggle`, `GroupDetailsForm`, `GroupMembersPanel`, `GroupBroadcast`, `GroupLessonAccess`, `MessageActions`, `TemplatePicker`, `DuplicateExamButton`.

`ShareProfile` (`components/ShareProfile.tsx`) on `/teacher/me`: the teacher's public profile URL (`window.location.origin + /teacher/<slug>`, so it's correct on any domain), a scannable QR code generated client-side with the `qrcode` package (downloadable PNG), a copy button, and WhatsApp/Telegram share links.

### Removed: the localStorage teacher demo

The old browser-local teacher demo is **gone** — deleted, not deprecated. That covered `/teacher-login` (shared demo password `123456` + teacher picker), `/teacher-dashboard/**` (content designer), `/teacher/[slug]/lesson-draft/[draftId]`, and `lib/useTeacherAuth.ts`, `lib/useLessonDrafts.ts`, `lib/mediaStore.ts`, `lib/useTeacherProfile.ts`, `lib/students.ts`. Teachers now sign in through the normal `/login` and manage real Supabase content at `/teacher/me/content`. Do not reintroduce a separate teacher login.

`lib/teachers.ts` and `scripts/seed.ts` (`npm run seed`) are deliberately **kept** as a dev-only seed source — they are not imported by any page, so they cost nothing in the bundle, and they make the demo directory reproducible on a fresh database.

The six seeded demo teachers were deleted from the live database (their units, lessons and attachments cascaded). Real teacher rows are distinguished by `owner_id is not null` — the seed rows had `owner_id is null`, which is the safe discriminator if you ever need to purge seed data again.

### Student profiles, teacher messages, and access grants (`0008`)

**Student data** lives on `profiles` (`grade`, `school`, `city`, `age`, `avatar_url`, `phone`, `whatsapp`, `guardian_phone`, `profile_done`). Only name and grade are required — **the phone numbers are deliberately optional** and the form says so. `saveStudentProfile` (`app/actions/student-profile.ts`) rejects teacher accounts, since the roles are exclusive. A teacher can read a follower's profile only through the `profiles_teacher_reads_followers` policy, which is keyed on `follows` (the older policy keyed on the dead `subscriptions` table and never matched).

**Teacher messages** (`teacher_messages`) are a **two-way thread** since `0011`. `sender` is `teacher` or `student`; `student_id` set = a private thread with one student; `student_id null` = broadcast to every follower (teacher-only). A student may insert only rows where `sender = 'student'`, `student_id = auth.uid()`, they already follow that teacher, and they do not own a `teachers` row — so nobody can impersonate a teacher, message a stranger, or fake a broadcast. Teachers answer inline from `/teacher/me/students`, where threads awaiting a reply sort first. Students read them on `/dashboard`; RLS lets a student see only messages addressed to them or broadcasts from teachers they actually follow. Bodies are `stripTags`-ed — they render as plain text, never HTML.

**Access grants** (`student_grants` + `lessons.is_restricted` / `live_sessions.is_restricted`): a teacher marks a lesson or session "خاص", then grants specific followers access from `/teacher/me/students`. A grant row with both `lesson_id` and `session_id` null means "all of this teacher's restricted content".

Enforcement is in the `lessons` / `live_sessions` SELECT policies via the `security definer` helper `has_grant()`: a restricted row is **hidden entirely** from anyone without a grant — title included. RLS filters rows, not columns, so full-row hiding is the only real guarantee here; there is no "locked but visible" state for restricted content (unlike the visitor gate, which hides columns). Consequence: lesson counts legitimately differ per student.

## Conventions

- Path alias `@/*` maps to the repository root (see `tsconfig.json`).
- Arabic-Indic numerals (٩٠ دقيقة) appear inside data strings; UI-computed numbers render as Latin digits.
- **PWA**: `public/manifest.webmanifest`, generated icons (`icon-*.png`, `apple-touch-icon.png`), and `public/sw.js`, registered by `components/ServiceWorker.tsx`. `components/InstallApp.tsx` shows an install button on Android/Chrome via `beforeinstallprompt`, and an "add to home screen" hint on iOS Safari (which has no such event); it hides itself when already installed or dismissed. **The service worker never caches HTML** — pages depend on auth state, so a cached page could show one account's data to another on a shared device. Only `/_next/static/` and other user-data-free assets are cached, plus `offline.html`.
- Styling lives entirely in `app/globals.css` (plain CSS + custom properties, no Tailwind/CSS modules). Mobile breakpoint is 720px.
- **Form controls are styled on the element, not by class.** `input` / `select` / `textarea` get their border, 12px radius, focus ring and disabled state from element selectors near `.form-label`; `select` additionally gets `appearance: none` and a hand-drawn chevron pinned to the **inline end** (left, since the app is RTL). Write `<input>` and `<select>` bare — **do not add a styling class**, and do not reintroduce per-form copies. Before this, more than a hundred fields carried no class at all and rendered with the browser's default chrome next to carefully styled buttons, which is what made screens look half-designed. Element rules are weaker than any class, so `.search-input` / `.filter-select` / `.rte-select` still win where they set something; each of those had to gain a `padding-inline-end` because their `padding` shorthand erases the room reserved for the arrow — a new compact select needs the same.
- **Width and the 44px minimum apply only to `.form-field > input|select|textarea`.** A standalone control in a toolbar or search bar sizes to its content; forcing `width: 100%` globally would make it eat its row.
- **`.form-row` serves both button rows and field rows**, so only `.form-row > .form-field` grows (`flex: 1 1 220px`). On mobile it stacks via `flex-basis: 100%`, never `flex-direction: column` — in a column `flex-basis` becomes *height*, which is what opened tall blank gaps between fields (the same trap as `.exam-kind` and `.exam-card-main`).
- Placeholder media is CSS-only (gradients + initials/emoji). Lesson videos are Google's public sample MP4s; attachments point at three real PDFs in `public/files/`.
