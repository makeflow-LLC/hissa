-- ============================================================
-- تفعيل المرفقات فعلياً + حفظ نتائج الاختبارات
--
-- كان قسم «المرفقات» يظهر لكل طالب بلا أي طريقة لرفع ملف، وكانت
-- أسئلة الاختبار تُحلّ في المتصفح ولا يُحفظ منها شيء — فلا يرى
-- المعلّم إجابة واحدة. هذه الهجرة تغلق الفجوتين.
-- ============================================================

alter table public.lesson_attachments drop constraint if exists lesson_attachments_kind_check;
alter table public.lesson_attachments
  add constraint lesson_attachments_kind_check
  check (kind in ('pdf','worksheet','image','doc','slides','sheet','other'));

-- الحاوية نفسها (lesson-media) تستقبل ملفات المرفقات لا الصور فقط.
-- سياسة المجلد <auth.uid()>/... من 0007 تنطبق عليها كما هي.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','application/zip'
],
file_size_limit = 20971520
where id = 'lesson-media';

-- محاولة واحدة لكل (درس، طالب) — تُحدَّث عند إعادة الحل
create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  score      smallint not null,
  total      smallint not null,
  answers    jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);
create index if not exists quiz_attempts_lesson_idx on public.quiz_attempts (lesson_id);
create index if not exists quiz_attempts_student_idx on public.quiz_attempts (student_id);
alter table public.quiz_attempts enable row level security;

drop policy if exists "attempts_student_own" on public.quiz_attempts;
create policy "attempts_student_own" on public.quiz_attempts for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "attempts_teacher_reads_own_lessons" on public.quiz_attempts;
create policy "attempts_teacher_reads_own_lessons" on public.quiz_attempts for select
  using (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = quiz_attempts.lesson_id and t.owner_id = auth.uid()
    )
  );

revoke all on public.quiz_attempts from anon;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
