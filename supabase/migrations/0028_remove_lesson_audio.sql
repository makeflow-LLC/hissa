-- ------------------------------------------------------------
-- 0028 — إزالة «تحويل الدرس إلى صوت»
--
-- أُزيلت الميزة بطلب المالك. والعمود يُسقَط لا يُترك: بخلاف
-- `live_sessions` و`enrollments` اللذين بقيا لأن إسقاطهما هدمٌ لا رجعة
-- فيه لجدولٍ كامل، هذا عمودٌ واحد لم يحمل بيانات إنتاجية قطّ.
--
-- والملفّات المرفوعة — إن وُجدت — تبقى في حاوية `lesson-media` بلا
-- مرجع. حذفها من هنا غير ممكن، وهي داخل مجلّد المعلّم فلا تُقرأ إلا
-- برابطها العشوائي.
-- ------------------------------------------------------------

alter table public.lessons drop column if exists audio_url;

-- ونوع الاستهلاك يعود إلى ما تعرفه الشيفرة: لا `tts` بعد اليوم.
-- الأسطر القديمة إن وُجدت تُبقى ولا تُحذف — السجلّ قصّةٌ تُقرأ — ولذلك
-- يُحوَّل نوعها لا يُمسح صفّها.
update public.ai_usage set kind = 'summary' where kind = 'tts';

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('quiz', 'summary', 'format', 'design', 'poster'));

create or replace function public.spend_credits(n integer, k text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t_id uuid;
  left_over integer;
begin
  if n is null or n < 1 or n > 20 then
    raise exception 'bad amount';
  end if;
  if k not in ('quiz', 'summary', 'format', 'design', 'poster') then
    raise exception 'bad kind';
  end if;

  select id into t_id from teachers where owner_id = auth.uid();
  if t_id is null then
    return -1;
  end if;

  update teachers
     set credits = credits - n
   where id = t_id and credits >= n
  returning credits into left_over;

  if left_over is null then
    return -1;
  end if;

  insert into ai_usage (teacher_id, kind, credits, tokens, cost)
  values (t_id, k, n, 0, 0);

  return left_over;
end;
$$;

create or replace function public.refund_credits(n integer, k text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t_id uuid;
  left_over integer;
begin
  if n is null or n < 1 or n > 20 then
    raise exception 'bad amount';
  end if;
  if k not in ('quiz', 'summary', 'format', 'design', 'poster') then
    raise exception 'bad kind';
  end if;

  select id into t_id from teachers where owner_id = auth.uid();
  if t_id is null then
    return -1;
  end if;

  if not exists (
    select 1 from ai_usage a
     where a.teacher_id = t_id and a.kind = k and a.credits = n
       and a.created_at > now() - interval '10 minutes'
  ) then
    return -1;
  end if;

  update teachers set credits = credits + n where id = t_id
  returning credits into left_over;

  insert into ai_usage (teacher_id, kind, credits, tokens, cost)
  values (t_id, k, -n, 0, 0);

  return coalesce(left_over, -1);
end;
$$;
