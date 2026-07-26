-- ============================================================
-- منصة حصة — سياسات الحماية (Row Level Security)
--
-- المبدأ: RLS مفعّل على كل جدول. ما لا تسمح به سياسة صريحة فهو
-- ممنوع تلقائياً — حتى لو أخطأنا في كود الواجهة.
--
-- ملاحظة مرحلية: المحتوى المنشور مقروء للجميع الآن (يطابق سلوك
-- الموقع الحالي حيث الدروس مفتوحة). عند تفعيل الاشتراكات المدفوعة
-- تُستبدل سياسات القراءة بسياسة «المشترك النشط فقط» — مثال جاهز
-- معلّق في نهاية الملف.
-- ============================================================

alter table public.teachers           enable row level security;
alter table public.units              enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_attachments enable row level security;
alter table public.quiz_questions     enable row level security;
alter table public.live_sessions      enable row level security;
alter table public.profiles           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.lesson_progress    enable row level security;

-- ---------- المعلمون ----------
-- الدليل عام: أي زائر يتصفح المعلمين
create policy "teachers_public_read"
  on public.teachers for select
  using (true);

-- المعلم يعدّل بروفايله هو فقط (الاسم/النبذة/الصورة/الواتساب/المراحل)
create policy "teachers_owner_update"
  on public.teachers for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------- الوحدات ----------
create policy "units_public_read"
  on public.units for select
  using (true);

create policy "units_owner_write"
  on public.units for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = units.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = units.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ---------- الدروس ----------
-- الزوار يرون المنشور فقط؛ المعلم يرى مسوداته أيضاً
create policy "lessons_read_published_or_own"
  on public.lessons for select
  using (
    status = 'published'
    or exists (
      select 1 from public.teachers t
      where t.id = lessons.teacher_id and t.owner_id = auth.uid()
    )
  );

create policy "lessons_owner_write"
  on public.lessons for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = lessons.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = lessons.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ---------- مرفقات وأسئلة الدرس (تتبع درسها) ----------
create policy "attachments_read"
  on public.lesson_attachments for select
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_attachments.lesson_id
        and (
          l.status = 'published'
          or exists (
            select 1 from public.teachers t
            where t.id = l.teacher_id and t.owner_id = auth.uid()
          )
        )
    )
  );

create policy "attachments_owner_write"
  on public.lesson_attachments for all
  using (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_attachments.lesson_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_attachments.lesson_id and t.owner_id = auth.uid()
    )
  );

create policy "quiz_read"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.lessons l
      where l.id = quiz_questions.lesson_id
        and (
          l.status = 'published'
          or exists (
            select 1 from public.teachers t
            where t.id = l.teacher_id and t.owner_id = auth.uid()
          )
        )
    )
  );

create policy "quiz_owner_write"
  on public.quiz_questions for all
  using (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = quiz_questions.lesson_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = quiz_questions.lesson_id and t.owner_id = auth.uid()
    )
  );

-- ---------- الحصص المباشرة ----------
create policy "live_read_published_or_own"
  on public.live_sessions for select
  using (
    status = 'published'
    or exists (
      select 1 from public.teachers t
      where t.id = live_sessions.teacher_id and t.owner_id = auth.uid()
    )
  );

create policy "live_owner_write"
  on public.live_sessions for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = live_sessions.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = live_sessions.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ---------- ملفات المستخدمين ----------
-- كل مستخدم يقرأ ويعدّل ملفه هو
create policy "profiles_self_read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_self_write"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- المعلم يقرأ ملفات طلابه المشتركين (لجدول الطلاب في لوحة التحكم)
create policy "profiles_teacher_reads_subscribers"
  on public.profiles for select
  using (
    exists (
      select 1 from public.subscriptions s
      join public.teachers t on t.id = s.teacher_id
      where s.student_id = profiles.id and t.owner_id = auth.uid()
    )
  );

-- ---------- الاشتراكات ----------
-- الطالب يرى ويدير اشتراكاته؛ المعلم يرى اشتراكات طلابه
create policy "subscriptions_student_read"
  on public.subscriptions for select
  using (student_id = auth.uid());

create policy "subscriptions_student_insert"
  on public.subscriptions for insert
  with check (student_id = auth.uid());

create policy "subscriptions_teacher_read"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.teachers t
      where t.id = subscriptions.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ---------- تقدّم الطلاب ----------
-- الطالب يسجّل تقدّمه هو فقط؛ المعلم يطّلع على تقدّم طلابه في دروسه
create policy "progress_student_all"
  on public.lesson_progress for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "progress_teacher_read"
  on public.lesson_progress for select
  using (
    exists (
      select 1 from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_progress.lesson_id and t.owner_id = auth.uid()
    )
  );

-- ============================================================
-- للمستقبل (عند تفعيل الاشتراكات المدفوعة): استبدل سياسة قراءة
-- الدروس العامة بهذه — المشترك النشط فقط يرى محتوى الدرس:
--
-- drop policy "lessons_read_published_or_own" on public.lessons;
-- create policy "lessons_subscribers_read"
--   on public.lessons for select
--   using (
--     exists (
--       select 1 from public.subscriptions s
--       where s.teacher_id = lessons.teacher_id
--         and s.student_id = auth.uid()
--         and s.status = 'active'
--     )
--     or exists (
--       select 1 from public.teachers t
--       where t.id = lessons.teacher_id and t.owner_id = auth.uid()
--     )
--   );
-- ============================================================
