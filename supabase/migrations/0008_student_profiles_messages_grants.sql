-- ============================================================
-- بيانات الطالب + رسائل المعلّم + منح الوصول للمحتوى الخاص
-- ============================================================

-- ---------- ١) بيانات الطالب على profiles ----------
alter table public.profiles
  add column if not exists avatar_url     text,
  add column if not exists grade          text not null default '',
  add column if not exists school         text not null default '',
  add column if not exists city           text not null default '',
  add column if not exists age            smallint,
  add column if not exists phone          text,
  add column if not exists whatsapp       text,
  add column if not exists guardian_phone text,
  add column if not exists profile_done   boolean not null default false;

-- العمر ضمن مدى معقول لطالب مدرسة (يُسمح بـ null)
alter table public.profiles drop constraint if exists profiles_age_range;
alter table public.profiles
  add constraint profiles_age_range check (age is null or (age >= 4 and age <= 100));

-- المعلّم يقرأ بيانات من يتابعه (السياسة القديمة تعتمد subscriptions المهجور)
drop policy if exists "profiles_teacher_reads_followers" on public.profiles;
create policy "profiles_teacher_reads_followers"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.follows f
      join public.teachers t on t.id = f.teacher_id
      where f.student_id = profiles.id and t.owner_id = auth.uid()
    )
  );

-- المعلّم يقرأ تقدّم متابعيه في دروسه هو فقط
drop policy if exists "progress_teacher_reads_own_lessons" on public.lesson_progress;
create policy "progress_teacher_reads_own_lessons"
  on public.lesson_progress for select
  using (
    exists (
      select 1
      from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_progress.lesson_id and t.owner_id = auth.uid()
    )
  );

-- ---------- ٢) المحتوى الخاص ----------
-- درس/حصة مُعلَّمة كخاصة لا تظهر إلا لمن منحه المعلّم وصولاً
alter table public.lessons
  add column if not exists is_restricted boolean not null default false;
alter table public.live_sessions
  add column if not exists is_restricted boolean not null default false;

create table if not exists public.student_grants (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  -- درس بعينه، أو حصة بعينها، أو (كلاهما null) = كل محتوى هذا المعلّم الخاص
  lesson_id  uuid references public.lessons (id) on delete cascade,
  session_id uuid references public.live_sessions (id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now(),
  constraint student_grants_one_target check (
    lesson_id is null or session_id is null
  )
);

create unique index if not exists student_grants_unique
  on public.student_grants (
    teacher_id, student_id,
    coalesce(lesson_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists student_grants_student_idx
  on public.student_grants (student_id);

alter table public.student_grants enable row level security;

-- الطالب يرى منحه؛ المعلّم يرى ويكتب منح طلابه
drop policy if exists "grants_student_read" on public.student_grants;
create policy "grants_student_read"
  on public.student_grants for select
  using (student_id = auth.uid());

drop policy if exists "grants_teacher_all" on public.student_grants;
create policy "grants_teacher_all"
  on public.student_grants for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = student_grants.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = student_grants.teacher_id and t.owner_id = auth.uid()
    )
  );

-- هل للمستخدم الحالي وصول لمحتوى خاص؟ (منحة للعنصر نفسه أو منحة شاملة)
create or replace function public.has_grant(
  p_teacher_id uuid,
  p_lesson_id  uuid default null,
  p_session_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_grants g
    where g.teacher_id = p_teacher_id
      and g.student_id = auth.uid()
      and (
        (g.lesson_id is null and g.session_id is null)          -- منحة شاملة
        or (p_lesson_id is not null and g.lesson_id = p_lesson_id)
        or (p_session_id is not null and g.session_id = p_session_id)
      )
  );
$$;

revoke execute on function public.has_grant(uuid, uuid, uuid) from public;
grant execute on function public.has_grant(uuid, uuid, uuid) to anon, authenticated;

-- الدرس الخاص يختفي كصف كامل عمّن لا يملك منحة.
-- (RLS تفلتر الصفوف لا الأعمدة، فالإخفاء الكامل هو الضمان الوحيد هنا.)
drop policy if exists "lessons_read_published_or_own" on public.lessons;
create policy "lessons_read_published_or_own"
  on public.lessons for select
  using (
    (
      status = 'published'
      and (
        not is_restricted
        or public.has_grant(lessons.teacher_id, lessons.id, null)
      )
    )
    or exists (
      select 1 from public.teachers t
      where t.id = lessons.teacher_id and t.owner_id = auth.uid()
    )
  );

drop policy if exists "live_read_published_or_own" on public.live_sessions;
drop policy if exists "live_sessions_read_published_or_own" on public.live_sessions;
create policy "live_sessions_read_published_or_own"
  on public.live_sessions for select
  using (
    (
      status = 'published'
      and (
        not is_restricted
        or public.has_grant(live_sessions.teacher_id, null, live_sessions.id)
      )
    )
    or exists (
      select 1 from public.teachers t
      where t.id = live_sessions.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ---------- ٣) رسائل المعلّم ----------
create table if not exists public.teacher_messages (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  -- null = رسالة لكل المتابعين
  student_id uuid references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_messages_student_idx
  on public.teacher_messages (student_id, created_at desc);
create index if not exists teacher_messages_teacher_idx
  on public.teacher_messages (teacher_id, created_at desc);

alter table public.teacher_messages enable row level security;

-- الطالب يقرأ ما وُجّه إليه، أو التعميم من معلّم يتابعه
drop policy if exists "messages_student_read" on public.teacher_messages;
create policy "messages_student_read"
  on public.teacher_messages for select
  using (
    student_id = auth.uid()
    or (
      student_id is null
      and exists (
        select 1 from public.follows f
        where f.teacher_id = teacher_messages.teacher_id
          and f.student_id = auth.uid()
      )
    )
  );

drop policy if exists "messages_teacher_all" on public.teacher_messages;
create policy "messages_teacher_all"
  on public.teacher_messages for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = teacher_messages.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = teacher_messages.teacher_id and t.owner_id = auth.uid()
    )
  );

-- الزائر لا يقرأ الرسائل ولا المنح إطلاقاً
revoke all on public.teacher_messages from anon;
revoke all on public.student_grants from anon;
grant select, insert, update, delete on public.teacher_messages to authenticated;
grant select, insert, update, delete on public.student_grants to authenticated;

-- الأعمدة الجديدة في lessons محجوبة عن الزائر كبقية أعمدة المحتوى؟
-- is_restricted ليس محتوى، والزائر يحتاجه ليعرف أن الدرس خاص — لكنه
-- أصلاً لن يرى الصف. نمنحه للاتساق مع بقية الأعمدة الوصفية.
grant select (is_restricted) on public.lessons to anon;
