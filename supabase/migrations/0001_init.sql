-- ============================================================
-- منصة حصة — المخطط الأساسي
-- يقابل البيانات الحالية في lib/teachers.ts و lib/students.ts
-- والحالة المحلية في useLessonDrafts / useTeacherProfile /
-- useLessonProgress
-- ============================================================

-- المعلمون (يقابل Teacher + تعديلات useTeacherProfile كأعمدة حقيقية)
create table public.teachers (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  -- حساب Auth الذي يملك هذا البروفايل (يُربط في مرحلة تسجيل الدخول)
  owner_id     uuid references auth.users (id) on delete set null,
  name         text not null,
  subject      text not null,
  -- المراحل التي يدرّسها: ابتدائي / إعدادي / ثانوي (واحدة أو أكثر)
  stages       text[] not null default '{}',
  bio          text not null default '',
  initials     text not null default '',
  gradient     text not null default '',
  avatar_url   text,
  whatsapp     text,
  rating       numeric(2, 1) not null default 5.0,
  rating_count integer not null default 0,
  created_at   timestamptz not null default now()
);

-- الوحدات الدراسية (يقابل Unit)
create table public.units (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  title       text not null,
  description text not null default '',
  position    integer not null default 0
);

-- الدروس المسجّلة (يقابل RecordedLesson + مسودات useLessonDrafts:
-- «المسودة» صارت status='draft' والدرس المنشور status='published')
create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  unit_id     uuid references public.units (id) on delete set null,
  status      text not null default 'published'
              check (status in ('draft', 'published')),
  title       text not null,
  description text not null default '',
  duration    text not null default '',
  emoji       text not null default '📚',
  gradient    text not null default '',
  -- رابط الفيديو: عينة تجريبية الآن، وលاحقاً معرف Bunny Stream
  video_url   text,
  -- أقسام الشرح [{heading, paragraphs[]}] والمعرض [{emoji, caption, gradient, image_path}]
  sections    jsonb not null default '[]',
  gallery     jsonb not null default '[]',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- مرفقات الدرس (يقابل Attachment؛ file_path يشير لملف في Storage)
create table public.lesson_attachments (
  id        uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  name      text not null,
  kind      text not null default 'pdf' check (kind in ('pdf', 'worksheet')),
  size      text not null default '',
  file_path text not null,
  position  integer not null default 0
);

-- أسئلة الاختبار (يقابل QuizQuestion في المسودات)
create table public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  prompt        text not null,
  options       jsonb not null default '[]',
  correct_index integer not null default 0,
  position      integer not null default 0
);

-- الحصص المباشرة (يقابل LiveSession)
create table public.live_sessions (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  status      text not null default 'published'
              check (status in ('draft', 'published')),
  title       text not null,
  description text not null default '',
  schedule    text not null default '',
  duration    text not null default '',
  seats_left  integer not null default 0,
  emoji       text not null default '🔴',
  gradient    text not null default '',
  created_at  timestamptz not null default now()
);

-- ملفات المستخدمين (طلاب ومعلمون) — صف لكل حساب Auth
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'student'
             check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

-- اشتراكات الطلاب لدى المعلمين (يقابل students.subscribed)
create table public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  status     text not null default 'active'
             check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

-- تقدّم الطالب (يقابل useLessonProgress — درس منجز = صف هنا)
create table public.lesson_progress (
  student_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

-- فهارس للاستعلامات الشائعة (بروفايل معلم، دروس وحدة، تقدّم طالب)
create index lessons_teacher_status_idx on public.lessons (teacher_id, status);
create index lessons_unit_idx on public.lessons (unit_id, position);
create index units_teacher_idx on public.units (teacher_id, position);
create index live_sessions_teacher_idx on public.live_sessions (teacher_id, status);
create index attachments_lesson_idx on public.lesson_attachments (lesson_id, position);
create index quiz_lesson_idx on public.quiz_questions (lesson_id, position);
create index subscriptions_teacher_idx on public.subscriptions (teacher_id, status);
create index progress_lesson_idx on public.lesson_progress (lesson_id);
