# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

"منصة حصة" (Hissa Platform) is an Arabic-language, RTL digital-school platform built with Next.js. Students browse a searchable teacher directory; each teacher profile offers a curriculum of recorded lessons organized into units (with per-student progress tracking) plus bookable live sessions. Each recorded lesson has a full lesson page: video player, formatted explanation, illustration gallery, and downloadable attachments.

## Commands

```bash
npm install        # install dependencies
npm run dev        # development server on http://localhost:3000
npm run build      # production build (also type-checks)
npm run start      # serve the production build
```

There is no test suite; `npm run build` is the verification gate (compile + TypeScript check + static generation).

## Architecture

- **Next.js 15 App Router** with React 19 and TypeScript. All pages are statically generated.
- **RTL/Arabic-first**: the root layout (`app/layout.tsx`) sets `lang="ar" dir="rtl"` and renders the shared navbar/footer. All UI text is Arabic; keep new UI text in Arabic and layout direction-aware (prefer logical CSS properties — `inset-inline-start`, `padding-inline-start` — or direction-neutral flex/grid).
- **`lib/teachers.ts`** — the single source of truth for all data and types: `Teacher`, `Unit`, `RecordedLesson` (with `sections`, `gallery`, `attachments`), `LiveSession`, the `STAGES` tuple, and the mock data for six teachers (each: 2 units / 5 recorded lessons / 3 live sessions, plus `rating`/`ratingCount`). The `lesson()` helper expands compact drafts into full lessons (sample video URL rotation, standard section headings, gallery gradients, shared attachment files). Helpers: `getTeacherBySlug()`, `getAllLessons()` (curriculum order), `getLessonContext()` (lesson + prev/next).
- **Routes**:
  - `app/page.tsx` — home: hero + `TeacherDirectory`.
  - `app/teacher/[slug]/page.tsx` — profile: header with stats (lesson count, live count, star rating) + `TeacherTabs`.
  - `app/teacher/[slug]/lesson/[lessonId]/page.tsx` — lesson page: breadcrumb, `VideoPlayer`, content sections, gallery, attachments, prev/next navigation, `LessonCompleteButton`, unit lesson list. Both dynamic routes use `generateStaticParams` and `notFound()`; `params` is a `Promise` in Next 15 and must be awaited.
- **Client components**: `TeacherDirectory` (search/filter state), `TeacherTabs` (recorded/live tabs + progress bars), `VideoPlayer` (poster → HTML5 video), `LessonCompleteButton`. `Stars` is a server-renderable rating display.
- **Progress tracking** — `lib/useLessonProgress.ts` ("use client" hook): completed-lesson ids per teacher in `localStorage` under `hissa-progress:<teacherSlug>`, read after mount to avoid hydration mismatch. No backend.
- **Placeholder media**: teacher/lesson/gallery imagery is CSS-only (gradient blocks + initials/emoji stored in the data). Lesson videos use Google's public sample MP4s (`SAMPLE_VIDEOS`). Attachments link to three real placeholder PDFs in `public/files/` shared by all lessons.
- **Styling** lives entirely in `app/globals.css` using plain CSS with custom properties (no Tailwind/CSS modules). Mobile breakpoint is 720px.

## Conventions

- Path alias `@/*` maps to the repository root (see `tsconfig.json`).
- The "احجز" (book) buttons on live sessions are presentational only — there is no booking backend yet.
- Arabic-Indic numerals (٩٠ دقيقة) are used inside data strings; UI-computed numbers render as Latin digits.
