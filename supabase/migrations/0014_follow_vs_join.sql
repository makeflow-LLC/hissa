-- ============================================================
-- فصل «المتابعة» عن «الانضمام»، وقصر التقييم على المنضمّين
-- ============================================================
--
-- المتابعة إشارة اهتمام خفيفة: فورية، بلا موافقة، ولا تمنح شيئاً.
-- الانضمام هو الالتحاق بالصف: طلب يبتّه المعلّم، وهو وحده ما تُبنى عليه
-- الرسائل والمجموعات وبطاقات التقييم والمحتوى الخاص.
--
-- الحالتان في عمود `status` نفسه لا في جدول ثانٍ، فيبقى كل شرط
-- `status = 'approved'` القائم صحيحاً كما هو.

-- ------------------------------------------------------------
-- ١) حالة رابعة: following
-- ------------------------------------------------------------
alter table public.follows drop constraint if exists follows_status_check;
alter table public.follows add constraint follows_status_check
  check (status in ('following', 'pending', 'approved', 'rejected'));

-- المتابعة هي الفعل الافتراضي الآن؛ الانضمام خطوة يطلبها الطالب صراحةً
alter table public.follows alter column status set default 'following';

-- ------------------------------------------------------------
-- ٢) قاعدة «معلّم واحد لكل مادة» تخصّ الانضمام وحده
--
-- للطالب أن يتابع عشرة معلّمي رياضيات ليطالع محتواهم، لكنه لا يلتحق
-- بصفّ أكثر من واحد منهم.
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
  -- المتابعة والرفض لا يحجزان المادة
  if new.status not in ('pending', 'approved') then
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

-- ------------------------------------------------------------
-- ٣) الطالب يتابع، ويطلب الانضمام، ويتراجع — ولا يقبل نفسه
-- ------------------------------------------------------------
drop policy if exists "follows_student_request" on public.follows;
create policy "follows_student_request" on public.follows
  for insert to authenticated
  with check (
    student_id = auth.uid()
    -- 'approved' غائبة عمداً: القبول قرار المعلّم وحده
    and status in ('following', 'pending')
    and not exists (
      select 1 from public.teachers t where t.owner_id = auth.uid()
    )
  );

-- الانتقال بين المتابعة وطلب الانضمام على صفّه هو
drop policy if exists "follows_student_change" on public.follows;
create policy "follows_student_change" on public.follows
  for update to authenticated
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and status in ('following', 'pending')
  );

-- ------------------------------------------------------------
-- ٤) التقييم للمنضمّ وحده
--
-- كان الشرط إنجاز درس واحد، وهو أضعف من أن يدلّ على علاقة حقيقية:
-- أي طالب مسجَّل يفتح درساً ويعلّمه منجَزاً فيقيّم. القبول في الصف قرار
-- من المعلّم نفسه، فهو الدليل الأمتن على أن بينهما دراسة فعلية.
-- ------------------------------------------------------------
drop policy if exists "reviews_student_write" on public.reviews;
create policy "reviews_student_write" on public.reviews for all
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.follows f
      where f.student_id = auth.uid()
        and f.teacher_id = reviews.teacher_id
        and f.status = 'approved'
    )
  );
