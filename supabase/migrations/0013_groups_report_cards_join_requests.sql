-- ============================================================
-- مجموعات الطلاب، بطاقات التقييم، وطلبات الانضمام بموافقة المعلّم
-- ============================================================

-- ------------------------------------------------------------
-- ١) تطبيع النص العربي داخل قاعدة البيانات
--
-- نحتاجه لمقارنة تخصّصات المعلّمين: «رياضيات» و«الرياضيّات» و«رياضيات »
-- تخصّص واحد، ولو قارنّاها حرفياً لسمحنا للطالب بمتابعة معلّمَي رياضيات
-- معاً لمجرّد اختلاف تشكيلة. يوازي هذا ما يفعله lib/arabic.ts في الواجهة.
-- ------------------------------------------------------------
create or replace function public.normalize_ar(txt text)
returns text
language sql
immutable
strict
as $$
  select btrim(regexp_replace(
    -- «اللغة العربية» و«لغة عربية» مادة واحدة، فأداة التعريف تسقط
    regexp_replace(
      regexp_replace(
        translate(
          -- التشكيل والتطويل يُحذفان
          regexp_replace(lower(txt), E'[ً-ٰٟـ]', '', 'g'),
          -- توحيد صور الألف والياء والتاء المربوطة وحوامل الهمزة
          E'أإآٱىةؤئء',
          E'اااايهييي'
        ),
        '\s+', ' ', 'g'),
      '(^| )ال', '\1', 'g'),
    '\s+', ' ', 'g'));
$$;

comment on function public.normalize_ar(text) is
  'تطبيع عربي للمقارنة: حذف التشكيل والتطويل، وتوحيد الألف والياء والتاء المربوطة.';

-- ------------------------------------------------------------
-- ٢) شروط الانضمام التي يكتبها المعلّم مسبقاً
-- ------------------------------------------------------------
alter table public.teachers
  add column if not exists join_instructions text not null default '';

-- ------------------------------------------------------------
-- ٣) المتابعة صارت طلب انضمام يوافق عليه المعلّم
--
-- الافتراضي هنا 'approved' عمداً: هو يملأ الصفوف القائمة فلا تنقطع
-- متابعة قائمة لحظة الترقية. ثم نُبدّل الافتراضي إلى 'pending' فيسري
-- على كل طلب جديد.
-- ------------------------------------------------------------
alter table public.follows
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists decided_at timestamptz,
  add column if not exists student_note text not null default '',
  add column if not exists decision_note text not null default '';

alter table public.follows alter column status set default 'pending';

create index if not exists follows_status_idx on public.follows (teacher_id, status);

-- ------------------------------------------------------------
-- ٤) معلّم واحد لكل تخصّص
--
-- الطالب في صفّ واحد، فمتابعته معلّمَي رياضيات معاً تشتيت لا فائدة فيه.
-- الفرض هنا في قاعدة البيانات لا في الواجهة فقط: إخفاء زر لا يمنع طلباً
-- مُرسَلاً من خارج الصفحة.
-- ------------------------------------------------------------
create or replace function public.enforce_one_teacher_per_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_subject text;
  clash_name  text;
begin
  -- الطلب المرفوض لا يحجز التخصّص
  if new.status = 'rejected' then
    return new;
  end if;

  select normalize_ar(subject) into new_subject
  from teachers where id = new.teacher_id;

  if new_subject is null or new_subject = '' then
    return new;
  end if;

  select t.name into clash_name
  from follows f
  join teachers t on t.id = f.teacher_id
  where f.student_id = new.student_id
    and f.teacher_id <> new.teacher_id
    and f.status in ('pending', 'approved')
    and normalize_ar(t.subject) = new_subject
  limit 1;

  if clash_name is not null then
    raise exception 'ONE_TEACHER_PER_SUBJECT:%', clash_name
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists follows_one_teacher_per_subject on public.follows;
create trigger follows_one_teacher_per_subject
  before insert or update of teacher_id, status on public.follows
  for each row execute function public.enforce_one_teacher_per_subject();

-- ------------------------------------------------------------
-- ٥) سياسات follows: الطالب يطلب، والمعلّم يقرّر
-- ------------------------------------------------------------
drop policy if exists "follows_student_all" on public.follows;

create policy "follows_student_read" on public.follows
  for select to authenticated
  using (student_id = auth.uid());

-- الطالب يُنشئ طلباً معلّقاً باسمه هو فقط، ولا ينتحل صفة طالب وهو معلّم
create policy "follows_student_request" on public.follows
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and not exists (
      select 1 from public.teachers t where t.owner_id = auth.uid()
    )
  );

-- الطالب يسحب طلبه أو يلغي متابعته
create policy "follows_student_cancel" on public.follows
  for delete to authenticated
  using (student_id = auth.uid());

-- المعلّم يقبل أو يرفض طلبات صفحته هو
create policy "follows_teacher_decide" on public.follows
  for update to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = follows.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = follows.teacher_id and t.owner_id = auth.uid()
    )
  );

create policy "follows_teacher_remove" on public.follows
  for delete to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = follows.teacher_id and t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- ٦) الطلب المعلّق لا يمنح شيئاً
--
-- كل ما كان مبنيّاً على «يتابع» صار يشترط «قُبل». بدون هذا يصبح مجرّد
-- إرسال طلب بابَ وصولٍ إلى بيانات المعلّم ورسائله.
-- ------------------------------------------------------------
drop policy if exists "profiles_teacher_reads_followers" on public.profiles;
create policy "profiles_teacher_reads_followers"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.follows f
      join public.teachers t on t.id = f.teacher_id
      where f.student_id = profiles.id
        and t.owner_id = auth.uid()
        -- المعلّق داخل عمداً: المعلّم يحتاج اسم مقدّم الطلب وصفّه ليقرّر،
        -- والطالب هو من بادر إليه. المرفوض والغريب يبقيان محجوبين.
        and f.status in ('pending', 'approved')
    )
  );

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
          and f.status = 'approved'
      )
    )
  );

drop policy if exists "messages_student_write" on public.teacher_messages;
create policy "messages_student_write"
  on public.teacher_messages for insert to authenticated
  with check (
    sender = 'student'
    and student_id = auth.uid()
    and exists (
      select 1 from public.follows f
      where f.teacher_id = teacher_messages.teacher_id
        and f.student_id = auth.uid()
        and f.status = 'approved'
    )
    and not exists (
      select 1 from public.teachers t where t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- ٧) مجموعات الطلاب
-- ------------------------------------------------------------
create table if not exists public.student_groups (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  name        text not null,
  description text not null default '',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists student_groups_teacher_idx
  on public.student_groups (teacher_id, position);

create table if not exists public.student_group_members (
  group_id   uuid not null references public.student_groups (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index if not exists student_group_members_student_idx
  on public.student_group_members (student_id);

alter table public.student_groups        enable row level security;
alter table public.student_group_members enable row level security;

create policy "groups_teacher_all" on public.student_groups
  for all to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = student_groups.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = student_groups.teacher_id and t.owner_id = auth.uid()
    )
  );

-- الطالب يرى اسم المجموعة التي وُضع فيها فقط
-- سياسة المجموعات تستعلم عن الأعضاء، وسياسة الأعضاء تستعلم عن المجموعات،
-- فتدور RLS في حلقة لا تنتهي. نكسرها بدالة security definer تتخطّى RLS في
-- طرف واحد — نفس نهج has_grant() في 0008.
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from student_group_members
    where group_id = gid and student_id = uid
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

create policy "groups_student_read" on public.student_groups
  for select to authenticated
  using (public.is_group_member(student_groups.id, auth.uid()));

-- العضوية: المعلّم يضيف من يتابعه فعلاً (بعد القبول) لا أيّ مستخدم
create policy "group_members_teacher_all" on public.student_group_members
  for all to authenticated
  using (
    exists (
      select 1
      from public.student_groups g
      join public.teachers t on t.id = g.teacher_id
      where g.id = student_group_members.group_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.student_groups g
      join public.teachers t on t.id = g.teacher_id
      join public.follows f
        on f.teacher_id = g.teacher_id
       and f.student_id = student_group_members.student_id
       and f.status = 'approved'
      where g.id = student_group_members.group_id and t.owner_id = auth.uid()
    )
  );

create policy "group_members_student_read" on public.student_group_members
  for select to authenticated
  using (student_id = auth.uid());

-- ------------------------------------------------------------
-- ٨) بطاقات التقييم
-- ------------------------------------------------------------
create table if not exists public.report_cards (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.teachers (id) on delete cascade,
  student_id    uuid not null references auth.users (id) on delete cascade,
  -- بطاقة نهاية وحدة (unit_id) أو نهاية فصل (term نصّاً حرّاً)
  unit_id       uuid references public.units (id) on delete set null,
  term          text not null default '',
  title         text not null,
  -- تقديرات من ٥
  understanding smallint check (understanding is null or understanding between 0 and 5),
  participation smallint check (participation is null or participation between 0 and 5),
  homework      smallint check (homework      is null or homework      between 0 and 5),
  behavior      smallint check (behavior      is null or behavior      between 0 and 5),
  score         numeric(6, 2),
  max_score     numeric(6, 2),
  strengths     text not null default '',
  improvements  text not null default '',
  note          text not null default '',
  issued_at     timestamptz not null default now()
);

create index if not exists report_cards_student_idx
  on public.report_cards (student_id, issued_at desc);
create index if not exists report_cards_teacher_idx
  on public.report_cards (teacher_id, issued_at desc);

alter table public.report_cards enable row level security;

create policy "report_cards_teacher_all" on public.report_cards
  for all to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = report_cards.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.teachers t
      join public.follows f
        on f.teacher_id = t.id
       and f.student_id = report_cards.student_id
       and f.status = 'approved'
      where t.id = report_cards.teacher_id and t.owner_id = auth.uid()
    )
  );

create policy "report_cards_student_read" on public.report_cards
  for select to authenticated
  using (student_id = auth.uid());

-- ------------------------------------------------------------
-- ٩) الصلاحيات: لا شيء من هذا للزائر
-- ------------------------------------------------------------
revoke all on public.student_groups        from anon;
revoke all on public.student_group_members from anon;
revoke all on public.report_cards          from anon;

grant select, insert, update, delete on public.student_groups        to authenticated;
grant select, insert, update, delete on public.student_group_members to authenticated;
grant select, insert, update, delete on public.report_cards          to authenticated;
