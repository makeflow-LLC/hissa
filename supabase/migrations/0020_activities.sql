-- ============================================================
-- الأنشطة التفاعلية: محتوى واحد، وألعاب متبدّلة
-- ============================================================
--
-- الفكرة المركزية (وهي فكرة Wordwall): المعلّم يُدخل **أزواجاً** مرّةً
-- واحدة — كلمة ومعناها، سؤالاً وجوابه، عنصراً وفئته — ثم يختار كيف
-- تُلعَب: مطابقةً، أو بطاقات، أو اختياراً سريعاً، أو ترتيب حروف، أو
-- تصنيفاً، أو عجلة. تبديل نوع اللعبة **لا يمسّ المحتوى**، فلا يُعاد
-- إدخاله لكل لعبة.
--
-- لذلك `items` عمود `jsonb` واحد شكله [{a, b}] لا جدولٌ لكل لعبة:
-- الشكل مشترك بين الأنواع كلّها، ومعنى `a` و`b` هو ما يختلف.
--
-- **النشاط تدريبٌ لا امتحان.** ولذلك — بخلاف `exams` — تُرسَل الإجابات
-- إلى المتصفّح: المطابقةُ لا تُلعَب أصلاً دون أن يرى الطالب الطرفين.
-- ودرجة النشاط يحسبها المتصفّح وتُحفظ للتشجيع لا للتقويم، ولا تدخل في
-- أي معدّل رسمي. من أراد تقويماً محميّاً فـ `exams` هو موضعه.

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  /** مجموعة بعينها، أو null = كل طلاب المعلّم المنضمّين */
  group_id     uuid references public.student_groups (id) on delete set null,
  /** ربط اختياري بدرس، ليظهر النشاط في سياقه */
  lesson_id    uuid references public.lessons (id) on delete set null,
  title        text not null,
  instructions text not null default '',
  kind         text not null default 'match'
               check (kind in ('match', 'flashcards', 'quiz', 'anagram', 'sort', 'wheel')),
  /** [{a, b}] — معنى الطرفين يختلف باختلاف النوع */
  items        jsonb not null default '[]'::jsonb,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  created_at   timestamptz not null default now()
);

create index if not exists activities_teacher_idx
  on public.activities (teacher_id, created_at desc);
create index if not exists activities_group_idx
  on public.activities (group_id, status);

-- لعبات الطلاب: عدّة محاولات مسموحة عمداً — التكرار هو التدريب
create table if not exists public.activity_plays (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  student_id   uuid not null references auth.users (id) on delete cascade,
  score        numeric(7, 2) not null default 0,
  total        numeric(7, 2) not null default 0,
  seconds      int not null default 0,
  played_at    timestamptz not null default now()
);

create index if not exists activity_plays_activity_idx
  on public.activity_plays (activity_id, played_at desc);
create index if not exists activity_plays_student_idx
  on public.activity_plays (student_id, played_at desc);

-- ------------------------------------------------------------
-- الصلاحيات
-- ------------------------------------------------------------
alter table public.activities     enable row level security;
alter table public.activity_plays enable row level security;

/**
 * هل يجوز للطالب الحالي أن يلعب هذا النشاط؟
 * منشور، وموجّه إلى مجموعةٍ هو فيها أو إلى كل طلاب معلّمه المنضمّين.
 *
 * `security definer` لكسر الدوران: سياسة `activity_plays` تحتاج قراءة
 * `activities`، وسياسة `activities` تقرأ العضوية — نفس ما فعله
 * `is_group_member()` في 0013.
 */
create or replace function public.can_play_activity(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from activities a
    where a.id = a_id
      and a.status = 'published'
      and (
        (a.group_id is not null and exists (
          select 1 from student_group_members m
          where m.group_id = a.group_id and m.student_id = auth.uid()
        ))
        or (a.group_id is null and exists (
          select 1 from follows f
          where f.teacher_id = a.teacher_id
            and f.student_id = auth.uid()
            and f.status = 'approved'
        ))
      )
  );
$$;

/** هل يملك المستخدم الحالي هذا النشاط؟ */
create or replace function public.owns_activity(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from activities a
    join teachers t on t.id = a.teacher_id
    where a.id = a_id and t.owner_id = auth.uid()
  );
$$;

revoke all on function public.can_play_activity(uuid) from public, anon;
revoke all on function public.owns_activity(uuid)     from public, anon;
grant execute on function public.can_play_activity(uuid) to authenticated;
grant execute on function public.owns_activity(uuid)     to authenticated;

create policy "activities_teacher_all" on public.activities
  for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = activities.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = activities.teacher_id and t.owner_id = auth.uid())
    -- المجموعة — إن حُدّدت — يجب أن تكون من مجموعات هذا المعلّم
    and (
      group_id is null
      or exists (select 1 from public.student_groups g
                 where g.id = activities.group_id and g.teacher_id = activities.teacher_id)
    )
  );

create policy "activities_student_read" on public.activities
  for select to authenticated
  using (
    status = 'published'
    and (
      (group_id is not null and exists (
        select 1 from public.student_group_members m
        where m.group_id = activities.group_id and m.student_id = auth.uid()
      ))
      or (group_id is null and exists (
        select 1 from public.follows f
        where f.teacher_id = activities.teacher_id
          and f.student_id = auth.uid()
          and f.status = 'approved'
      ))
    )
  );

-- اللعبات: الطالب يسجّل لعبته ويقرأها، والمعلّم يقرأ لعبات أنشطته
create policy "plays_student_own" on public.activity_plays
  for select to authenticated
  using (student_id = auth.uid());

create policy "plays_student_insert" on public.activity_plays
  for insert to authenticated
  with check (student_id = auth.uid() and public.can_play_activity(activity_id));

create policy "plays_teacher_read" on public.activity_plays
  for select to authenticated
  using (public.owns_activity(activity_plays.activity_id));

-- الزائر لا يرى نشاطاً ولا لعبة
revoke all on public.activities     from anon;
revoke all on public.activity_plays from anon;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert on public.activity_plays to authenticated;

-- ------------------------------------------------------------
-- قوالب المعلّم — كقوالب الاختبارات تماماً
-- ------------------------------------------------------------
create table if not exists public.activity_templates (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  name        text not null,
  kind        text not null default 'match',
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_templates_teacher_idx
  on public.activity_templates (teacher_id, created_at desc);

alter table public.activity_templates enable row level security;

create policy "activity_templates_owner" on public.activity_templates
  for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = activity_templates.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = activity_templates.teacher_id and t.owner_id = auth.uid())
  );

revoke all on public.activity_templates from anon;
grant select, insert, update, delete on public.activity_templates to authenticated;
