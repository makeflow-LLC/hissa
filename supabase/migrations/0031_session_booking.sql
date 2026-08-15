-- ------------------------------------------------------------
-- 0031 — حجز موعدٍ مباشر مع المعلّم
--
-- **جداولٌ جديدة لا إحياءٌ لـ`live_sessions`/`enrollments`.** ذانك يشفّران
-- «الحصّة المدفوعة والاشتراك فيها» — نموذجٌ أُزيل من المنتج عمداً؛
-- وإحياؤهما يعيد الدفعَ إلى المنصّة من الباب الخلفيّ. وهنا لا مال يمرّ:
-- السعر **عرضٌ فقط** يكتبه المعلّم إن شاء، والتنسيق على واتساب بعد
-- الموافقة، والمنصّة لا تسجّل عنه شيئاً.
--
-- والنموذج على غرار Calendly: المعلّم يُدخل مواعيده مسبقاً، والطالب يرى
-- المتاح منها ويضغطه، فيصير الطلب **قيد المراجعة** حتى يضع المعلّم رابط
-- اللقاء ويوافق.
-- ------------------------------------------------------------

-- ============ ١) المواعيد التي يفتحها المعلّم ============

create table if not exists public.availability_slots (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  /** لحظةٌ مطلقة — يحسبها المتصفّح ويرسلها ISO (انظر درس نافذة الاختبارات) */
  starts_at   timestamptz not null,
  minutes     integer not null default 60 check (minutes between 10 and 480),
  /**
   * السعر اختياريّ ونصّيّ الدلالة: `null` = «يُتّفق عليه»، و0 = مجاني.
   * لا يُخصم ولا يُحصَّل ولا يدخل أي حساب — المنصّة لا تلمس المال.
   */
  price       numeric,
  currency    text not null default 'ILS',
  note        text not null default '',
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists slots_teacher_idx
  on public.availability_slots (teacher_id, starts_at);

alter table public.availability_slots enable row level security;

/*
 * المواعيد **يراها الجميع** — الزائر أيضاً.
 *
 * هي دعوةٌ للتسجيل لا بيانات: طالبٌ جديد يرى أن للمعلّم مواعيد متاحة
 * فيسجّل ليحجز. وإخفاؤها خلف الدخول يعني ألّا يعرف أحدٌ أن الميزة موجودة.
 * ولا تكشف شيئاً عن أحد: وقتٌ وسعرٌ وملاحظة كتبها المعلّم لينشرها.
 */
create policy "slots_public_read" on public.availability_slots
  for select to anon, authenticated
  using (true);

create policy "slots_owner_write" on public.availability_slots
  for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = availability_slots.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = availability_slots.teacher_id and t.owner_id = auth.uid())
  );

grant select on public.availability_slots to anon, authenticated;
grant insert, update, delete on public.availability_slots to authenticated;

-- ============ ٢) طلبات الحجز ============

create table if not exists public.session_bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.availability_slots (id) on delete cascade,
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  student_id   uuid not null references auth.users (id) on delete cascade,
  /** موضوع الحصّة كما كتبه الطالب */
  topic        text not null,
  /** أسماء الحاضرين — الحصّة قد تكون لطالبٍ أو لعدّة طلاب */
  participants text not null default '',
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  /** رابط اللقاء — يضعه المعلّم عند الموافقة، ولا يراه إلا صاحب الحجز */
  meet_url     text,
  teacher_note text not null default '',
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists bookings_teacher_idx
  on public.session_bookings (teacher_id, status, created_at desc);
create index if not exists bookings_student_idx
  on public.session_bookings (student_id, created_at desc);

/*
 * موعدٌ واحد لحجزٍ واحد.
 *
 * الفهرس **جزئيّ**: المرفوض والملغى لا يحجزان الموعد، فيعود متاحاً
 * لغيره. ولولاه لأمكن لطالبين أن يحجزا الموعد نفسه في اللحظة نفسها —
 * وهو ما لا يمنعه فحصٌ في الشيفرة مهما دقّ.
 */
create unique index if not exists bookings_one_per_slot
  on public.session_bookings (slot_id)
  where status in ('pending', 'approved');

alter table public.session_bookings enable row level security;

/** كلٌّ يرى حجزه: الطالب حجزه، والمعلّم حجوزات مواعيده */
create policy "bookings_student_read" on public.session_bookings
  for select to authenticated
  using (student_id = auth.uid());

create policy "bookings_teacher_read" on public.session_bookings
  for select to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = session_bookings.teacher_id and t.owner_id = auth.uid())
  );

/*
 * الطالب يطلب — و**الحالة `pending` إلزاماً**.
 *
 * `status = 'pending'` في `with check` يمنعه من أن يوافق على نفسه؛ ولا
 * سياسة UPDATE له إطلاقاً، فلا يبدّل الحالة ولا يكتب `meet_url` بعد
 * الإدراج. وRLS وحدها كافيةٌ هنا لأن الرفض شامل — بخلاف تسليم الواجب
 * الذي يحتاج تعديلاً جزئياً فاحتاج منحةَ أعمدة.
 */
create policy "bookings_student_book" on public.session_bookings
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and meet_url is null
    -- المعلّم لا يحجز عند نفسه: الدوران متعارضان في هذه المنصّة
    and not exists (select 1 from public.teachers t where t.owner_id = auth.uid())
    -- الموعد مفتوحٌ فعلاً وتابعٌ للمعلّم المذكور ولم يمضِ
    and exists (
      select 1 from public.availability_slots s
      where s.id = slot_id
        and s.teacher_id = session_bookings.teacher_id
        and s.is_open = true
        and s.starts_at > now()
    )
  );

/** الإلغاء حذفٌ لا تعديل: يلغي الطالب طلبه ما دام معلّقاً فيعود الموعد متاحاً */
create policy "bookings_student_cancel" on public.session_bookings
  for delete to authenticated
  using (student_id = auth.uid() and status = 'pending');

create policy "bookings_teacher_decide" on public.session_bookings
  for update to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = session_bookings.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = session_bookings.teacher_id and t.owner_id = auth.uid())
  );

revoke all on public.session_bookings from anon;
grant select, insert, update, delete on public.session_bookings to authenticated;

/*
 * واتساب المعلّم يُكشف لصاحب حجزٍ **موافَقٍ عليه**.
 *
 * الرقم محجوبٌ عن العموم عمداً (وإلا صار الدليل مصدر أرقام للجميع)،
 * ويُكشف اليوم لأعضاء مجموعات المعلّم. والموافقة على حجزٍ بعينه قرارٌ
 * من المعلّم نفسه، فهي إشارة الرضا نفسها — والتنسيق على السعر لا يقع
 * إلا عليه.
 */
create or replace function public.booking_whatsapp(b_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.whatsapp
    from session_bookings b
    join teachers t on t.id = b.teacher_id
   where b.id = b_id
     and b.student_id = auth.uid()
     and b.status = 'approved';
$$;

revoke all on function public.booking_whatsapp(uuid) from public, anon;
grant execute on function public.booking_whatsapp(uuid) to authenticated;

/*
 * المواعيد المتاحة، ومعها **هل حُجز الموعد**.
 *
 * الحجوزات محجوبةٌ عن غير صاحبها وصاحب الموعد — وهذا صحيح: موضوع الحصّة
 * وأسماء الحاضرين شأن من كتبها. لكن الطالب لا بدّ أن يعرف أن الموعد
 * مأخوذ، وإلا رأى عشرة أزرار خمسةٌ منها ترفض عند الضغط بخطأ قيدٍ فريد.
 *
 * فالدالّة `security definer` تُخرج **قيمةً منطقيّة واحدة** لا صفّاً: هي
 * بالضبط ما يعرضه أي تقويم مواعيد في الدنيا، ولا تكشف من حجز ولا لماذا.
 */
create or replace function public.teacher_open_slots(t_id uuid)
returns table (
  id        uuid,
  starts_at timestamptz,
  minutes   integer,
  price     numeric,
  currency  text,
  note      text,
  taken     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.starts_at, s.minutes, s.price, s.currency, s.note,
         exists (
           select 1 from session_bookings b
            where b.slot_id = s.id and b.status in ('pending', 'approved')
         ) as taken
    from availability_slots s
   where s.teacher_id = t_id
     and s.is_open = true
     and s.starts_at > now()
   order by s.starts_at;
$$;

revoke all on function public.teacher_open_slots(uuid) from public;
grant execute on function public.teacher_open_slots(uuid) to anon, authenticated;

-- الحجوزات تدخل البثّ اللحظي: يرى المعلّم الطلب فور وصوله، والطالب
-- الموافقة دون أن يحدّث الصفحة. وRLS هي المرشِّح كالعادة.
do $$
begin
  begin
    alter publication supabase_realtime add table public.session_bookings;
  exception when duplicate_object then null;
  end;
end $$;
