-- ============================================================
-- طبقات الوصول للطالب + التسجيل والمتابعة
-- (مطبّقة فعلاً على المشروع: mexpmtuqhvnphgeqqjuf)
-- نضيف الناقص فقط على السكيمة الموجودة
-- ============================================================

-- ١) حقول التسعير والعيّنة المجانية على الجداول الموجودة
alter table public.lessons
  add column if not exists is_free_preview boolean not null default false;

alter table public.live_sessions
  add column if not exists is_paid boolean not null default false,
  add column if not exists price numeric(10, 2) not null default 0,
  add column if not exists currency text not null default 'EGP';

-- عمود صريح للإنجاز (completed_at كان يدل عليه ضمناً)
alter table public.lesson_progress
  add column if not exists completed boolean not null default true;

-- ٢) تعليم درس واحد لكل معلم كعيّنة مجانية: أول درس في أول وحدة
with first_lesson as (
  select l.id
  from public.lessons l
  join public.units u on u.id = l.unit_id
  where u.position = 0 and l.position = 0
)
update public.lessons set is_free_preview = true
where id in (select id from first_lesson);

-- ٣) التسجيل في الحصص المباشرة
create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  -- enrolled: مؤكد | pending_payment: بانتظار تأكيد المعلم للدفع
  status     text not null default 'enrolled'
             check (status in ('enrolled', 'pending_payment', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

-- ٤) متابعة المعلمين
create table if not exists public.follows (
  student_id uuid not null references auth.users (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, teacher_id)
);

create index if not exists enrollments_student_idx on public.enrollments (student_id);
create index if not exists enrollments_session_idx on public.enrollments (session_id);
create index if not exists follows_teacher_idx on public.follows (teacher_id);

-- ٥) RLS على الجديد: كل طالب يرى بياناته فقط
alter table public.enrollments enable row level security;
alter table public.follows     enable row level security;

create policy "enrollments_student_read" on public.enrollments
  for select using (student_id = auth.uid());
create policy "enrollments_student_insert" on public.enrollments
  for insert with check (student_id = auth.uid());
create policy "enrollments_student_delete" on public.enrollments
  for delete using (student_id = auth.uid());

-- المعلم يرى تسجيلات حصصه هو (ليؤكد الدفع)
create policy "enrollments_teacher_read" on public.enrollments
  for select using (
    exists (
      select 1 from public.live_sessions s
      join public.teachers t on t.id = s.teacher_id
      where s.id = enrollments.session_id and t.owner_id = auth.uid()
    )
  );
create policy "enrollments_teacher_update" on public.enrollments
  for update using (
    exists (
      select 1 from public.live_sessions s
      join public.teachers t on t.id = s.teacher_id
      where s.id = enrollments.session_id and t.owner_id = auth.uid()
    )
  );

create policy "follows_student_all" on public.follows
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "follows_teacher_read" on public.follows
  for select using (
    exists (
      select 1 from public.teachers t
      where t.id = follows.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ٦) إنشاء سجل الطالب تلقائياً بعد أول دخول
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
