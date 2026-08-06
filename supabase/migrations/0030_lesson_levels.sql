-- ------------------------------------------------------------
-- 0030 — الدرس الواحد بمستويات قراءة
--
-- فكرة Diffit، ونحن أولى بها: العربية فيها فجوةٌ هائلة بين مفردات
-- الابتدائي والثانوي، ولا أداة تخدمها. والفرق عن Diffit أن النسخة تُحفظ
-- **داخل الدرس** لا في ملفٍّ يُصدَّر: فيبدّل الطالبُ مستواه بنفسه، ولا
-- يوزّع المعلّم أوراقاً مختلفة ولا تنقطع حلقة التقدّم.
--
-- المستوى `standard` **لا يُخزَّن هنا**: هو `lessons.sections` نفسه.
-- تخزينه مرّتين يعني نسختين تفترقان عند أول تعديل.
-- ------------------------------------------------------------

create table if not exists public.lesson_levels (
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  level      text not null check (level in ('simple', 'advanced')),
  sections   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (lesson_id, level)
);

alter table public.lesson_levels enable row level security;

/*
 * **البوّابة تُورَّث ولا تُعاد كتابتها.**
 *
 * الشرط `exists (select 1 from lessons ...)` يمرّ بسياسات `lessons`
 * نفسها — فلا يقرأ هذه النسخ إلا من يقرأ الدرس الأصلي: لا مسودّة، ولا
 * درساً مقيَّداً بلا منحة. وكتابةُ شرطٍ ثانٍ هنا تعني قاعدتين تفترقان
 * يوماً؛ والوراثة تعني بوّابةً واحدة.
 */
create policy "levels_read" on public.lesson_levels
  for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_levels.lesson_id));

create policy "levels_owner_write" on public.lesson_levels
  for all to authenticated
  using (
    exists (
      select 1 from public.lessons l join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_levels.lesson_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons l join public.teachers t on t.id = l.teacher_id
      where l.id = lesson_levels.lesson_id and t.owner_id = auth.uid()
    )
  );

/*
 * الزائر لا يصل إليها إطلاقاً — ولا حتى في درس العيّنة المجانية.
 * `get_free_preview_content` تعطيه النسخة الأصلية وكفى؛ وفتحُ بابٍ ثانٍ
 * للمحتوى يعني بوّابةً ثانية تُنسى عند أول تعديل.
 */
revoke all on public.lesson_levels from anon;
grant select, insert, update, delete on public.lesson_levels to authenticated;

-- ونوع استهلاكٍ سادس: تبسيط الدرس أو توسيعه
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('quiz', 'summary', 'format', 'design', 'poster', 'level'));

create or replace function public.spend_credits(n integer, k text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare t_id uuid; left_over integer;
begin
  if n is null or n < 1 or n > 20 then raise exception 'bad amount'; end if;
  if k not in ('quiz','summary','format','design','poster','level') then raise exception 'bad kind'; end if;
  select id into t_id from teachers where owner_id = auth.uid();
  if t_id is null then return -1; end if;
  update teachers set credits = credits - n where id = t_id and credits >= n returning credits into left_over;
  if left_over is null then return -1; end if;
  insert into ai_usage (teacher_id, kind, credits, tokens, cost) values (t_id, k, n, 0, 0);
  return left_over;
end; $$;

create or replace function public.refund_credits(n integer, k text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare t_id uuid; left_over integer;
begin
  if n is null or n < 1 or n > 20 then raise exception 'bad amount'; end if;
  if k not in ('quiz','summary','format','design','poster','level') then raise exception 'bad kind'; end if;
  select id into t_id from teachers where owner_id = auth.uid();
  if t_id is null then return -1; end if;
  if not exists (
    select 1 from ai_usage a
     where a.teacher_id = t_id and a.kind = k and a.credits = n
       and a.created_at > now() - interval '10 minutes'
  ) then return -1; end if;
  update teachers set credits = credits + n where id = t_id returning credits into left_over;
  insert into ai_usage (teacher_id, kind, credits, tokens, cost) values (t_id, k, -n, 0, 0);
  return coalesce(left_over, -1);
end; $$;
