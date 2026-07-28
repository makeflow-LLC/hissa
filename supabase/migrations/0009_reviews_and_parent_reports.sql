-- ============================================================
-- تقييمات الطلاب الحقيقية + تقرير المعلّم لوليّ الأمر
--
-- استُبدلت النجوم الوهمية (5.0 مكتوبة عند إنشاء البروفايل ولا يحدّثها
-- شيء) بتقييم يكتبه طالب استخدم المنهج فعلاً. المتوسط يُحسب بمشغّل
-- على teachers حتى تبقى بطاقة الدليل استعلاماً واحداً.
-- ============================================================

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);
create index if not exists reviews_teacher_idx on public.reviews (teacher_id, created_at desc);
alter table public.reviews enable row level security;

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews for select using (true);

-- شرط الأهلية داخل RLS نفسها: لا يقيّم إلا من أنجز درساً لهذا المعلّم
drop policy if exists "reviews_student_write" on public.reviews;
create policy "reviews_student_write" on public.reviews for all
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.lesson_progress lp
      join public.lessons l on l.id = lp.lesson_id
      where lp.student_id = auth.uid() and l.teacher_id = reviews.teacher_id
    )
  );

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

create or replace function public.recalc_teacher_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  tid := coalesce(new.teacher_id, old.teacher_id);
  update public.teachers t set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.teacher_id = tid), 0),
    rating_count = (select count(*) from public.reviews r where r.teacher_id = tid)
  where t.id = tid;
  return null;
end $$;

drop trigger if exists reviews_recalc on public.reviews;
create trigger reviews_recalc
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_teacher_rating();

update public.teachers set rating = 0, rating_count = 0 where rating_count = 0;

-- ============ تقرير وليّ الأمر ============
-- وليّ الأمر بلا حساب على المنصة، فالتقرير يُحفظ هنا ويُرسل له عبر
-- واتساب بضغطة من صفحة «طلابي» باستخدام guardian_phone.
create table if not exists public.parent_reports (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  student_id   uuid not null references auth.users (id) on delete cascade,
  period       text not null default '',
  performance  text not null default 'جيد'
               check (performance in ('ممتاز','جيد جداً','جيد','يحتاج متابعة')),
  strengths    text not null default '',
  improvements text not null default '',
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists parent_reports_student_idx on public.parent_reports (student_id, created_at desc);
create index if not exists parent_reports_teacher_idx on public.parent_reports (teacher_id, created_at desc);
alter table public.parent_reports enable row level security;

drop policy if exists "parent_reports_teacher_all" on public.parent_reports;
create policy "parent_reports_teacher_all" on public.parent_reports for all
  using (exists (select 1 from public.teachers t
                 where t.id = parent_reports.teacher_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.teachers t
                 where t.id = parent_reports.teacher_id and t.owner_id = auth.uid()));

drop policy if exists "parent_reports_student_read" on public.parent_reports;
create policy "parent_reports_student_read" on public.parent_reports for select
  using (student_id = auth.uid());

revoke all on public.parent_reports from anon;
grant select, insert, update, delete on public.parent_reports to authenticated;
