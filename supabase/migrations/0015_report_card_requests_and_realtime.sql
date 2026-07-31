-- ============================================================
-- طلب الطالب بطاقة تقييم + بثّ الرسائل لحظياً
-- ============================================================

-- ------------------------------------------------------------
-- ١) طلبات بطاقات التقييم
--
-- البطاقة تصدر بمبادرة المعلّم، لكن الطالب قد يحتاجها (لوليّ أمره، أو
-- ليعرف أين يقف) فلا يجد سبيلاً لطلبها إلا خارج المنصة. هذا الجدول هو
-- ذلك السبيل: طلب مجرّد بلا نصّ — المعلّم هو من يقرّر الوحدة والفصل
-- والتقديرات عند الإصدار.
-- ------------------------------------------------------------
create table if not exists public.report_card_requests (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending'
             check (status in ('pending', 'done', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists report_card_requests_teacher_idx
  on public.report_card_requests (teacher_id, status, created_at);
create index if not exists report_card_requests_student_idx
  on public.report_card_requests (student_id, created_at desc);

-- طلب معلّق واحد لكل (معلّم، طالب): لا يُغرق الطالب لوحة معلّمه بالطلبات
create unique index if not exists report_card_requests_one_pending
  on public.report_card_requests (teacher_id, student_id)
  where status = 'pending';

alter table public.report_card_requests enable row level security;

-- الطالب المنضمّ وحده يطلب، وباسمه هو
create policy "rc_requests_student_insert" on public.report_card_requests
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.follows f
      where f.student_id = auth.uid()
        and f.teacher_id = report_card_requests.teacher_id
        and f.status = 'approved'
    )
  );

create policy "rc_requests_student_read" on public.report_card_requests
  for select to authenticated
  using (student_id = auth.uid());

-- للطالب أن يسحب طلبه ما دام معلّقاً
create policy "rc_requests_student_cancel" on public.report_card_requests
  for delete to authenticated
  using (student_id = auth.uid() and status = 'pending');

create policy "rc_requests_teacher_all" on public.report_card_requests
  for all to authenticated
  using (
    exists (
      select 1 from public.teachers t
      where t.id = report_card_requests.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = report_card_requests.teacher_id and t.owner_id = auth.uid()
    )
  );

revoke all on public.report_card_requests from anon;
grant select, insert, update, delete on public.report_card_requests to authenticated;

-- ------------------------------------------------------------
-- ٢) بثّ لحظي للرسائل
--
-- بدون هذا لا يعرف الطرف الآخر بوصول رسالة حتى يحدّث الصفحة يدوياً.
-- الاشتراك يمرّ على RLS كأي قراءة: الطالب لا يستلم إلا ما تسمح له
-- سياسة messages_student_read برؤيته، والمعلّم رسائل صفّه هو.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.teacher_messages;
alter publication supabase_realtime add table public.report_card_requests;
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.report_cards;

-- الهوية الكاملة تلزم لتطبيق RLS على أحداث التحديث والحذف لا الإدراج فقط
alter table public.teacher_messages      replica identity full;
alter table public.report_card_requests  replica identity full;
alter table public.follows               replica identity full;
alter table public.report_cards          replica identity full;
