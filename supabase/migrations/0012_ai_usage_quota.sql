-- ============================================================
-- تتبّع استهلاك الذكاء الاصطناعي وسقف شهري لكل معلّم
--
-- التسجيل كمعلّم مفتوح للجميع، والمنصة مجانية بلا دخل — فبلا سقف
-- يستطيع أي شخص يفتح حساباً أن يستنزف رصيد المزوّد. الصف يُكتب بعد
-- كل استدعاء ناجح، وعدّ صفوف الشهر الجاري هو ما يفرض السقف.
-- ============================================================

create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  kind       text not null check (kind in ('quiz','summary','format')),
  tokens     integer not null default 0,
  cost       numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_teacher_month_idx
  on public.ai_usage (teacher_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_owner" on public.ai_usage;
create policy "ai_usage_owner" on public.ai_usage for all
  using (exists (select 1 from public.teachers t
                 where t.id = ai_usage.teacher_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.teachers t
                 where t.id = ai_usage.teacher_id and t.owner_id = auth.uid()));

revoke all on public.ai_usage from anon;
grant select, insert on public.ai_usage to authenticated;
