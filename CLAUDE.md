# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

"منصة حصة" (Hissa Platform) is an Arabic-language, RTL educational platform built with Next.js. It presents a directory of teachers that students can search and filter, with per-teacher profile pages listing bookable lessons.

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
- **RTL/Arabic-first**: the root layout (`app/layout.tsx`) sets `lang="ar" dir="rtl"`. All UI text is Arabic; keep new UI text in Arabic and layout direction-aware (prefer logical CSS properties or direction-neutral flex/grid).
- **`lib/teachers.ts`** — the single source of truth for all data: `Teacher` and `Lesson` types, the `STAGES` tuple (ابتدائي / إعدادي / ثانوي), the mock data for six teachers (three lessons each), the derived `subjects` list, and `getTeacherBySlug()`. Add or edit teachers/lessons here only.
- **`app/page.tsx`** — home page (server component) rendering the hero header plus `TeacherDirectory`.
- **`components/TeacherDirectory.tsx`** — client component owning search/filter state (name query, stage, subject) with `useMemo`-derived results; renders the teacher cards grid.
- **`app/teacher/[slug]/page.tsx`** — teacher profile page. Uses `generateStaticParams` from the teachers data and calls `notFound()` for unknown slugs. Note: `params` is a `Promise` in Next 15 and must be awaited.
- **Placeholder imagery** is CSS-only: colored gradient blocks with initials (teachers) or emoji (lessons), stored as `gradient`/`initials`/`emoji` fields in the data. No image files or remote images.
- **Styling** lives entirely in `app/globals.css` using plain CSS with custom properties (no Tailwind/CSS modules). Mobile breakpoint is 720px.

## Conventions

- Path alias `@/*` maps to the repository root (see `tsconfig.json`).
- The "احجز" (book) buttons are presentational only — there is no booking backend yet.
