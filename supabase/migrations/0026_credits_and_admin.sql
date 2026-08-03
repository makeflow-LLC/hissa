-- ------------------------------------------------------------
-- 0026 — رصيدٌ لكل معلّم بدل السقف الشهري، ولوحةُ إدارة تتحكّم فيه
--
-- كان الحدّ عدّاً شهرياً في الشيفرة (`MONTHLY_LIMIT`): لا يفرّق بين أداةٍ
-- رخيصة وأخرى غالية، ولا يستطيع أحدٌ زيادته لمعلّمٍ بعينه، ويصفّر نفسه
-- أوّل الشهر بلا قرار. والرصيد يحلّ الثلاثة: لكل أداة ثمنها، والإدارة
-- تمنح وتمنع، والرصيد يبقى حتى يُنفَق.
-- ------------------------------------------------------------

-- ============ ١) الرصيد على صفّ المعلّم ============

alter table public.teachers
  add column if not exists credits integer not null default 40;

alter table public.teachers
  drop constraint if exists teachers_credits_nonneg;
alter table public.teachers
  add constraint teachers_credits_nonneg check (credits >= 0);

/*
 * **المعلّم لا يكتب رصيده.**
 *
 * سياسة `teachers` تسمح لمالك الصفّ بالتعديل، وRLS يرشّح الصفوف لا
 * الأعمدة — فبدون هذا الحاجز يستطيع أيّ معلّم أن يرسل PATCH على صفّه
 * بـ`credits = 999999` من REST مباشرةً، والزرّ المخفيّ في الواجهة لا
 * يمنع شيئاً. فنُسقط منحة UPDATE الشاملة ونعيدها **عموداً عموداً** بلا
 * `credits`، تماماً كما تُحجب أعمدة محتوى الدرس عن الزائر في 0004.
 */
revoke update on public.teachers from authenticated, anon;

grant update (
  slug, name, subject, stages, bio, initials, gradient, avatar_url,
  whatsapp, qualification, experience_years, is_published,
  join_instructions, availability, availability_note, availability_at
) on public.teachers to authenticated;

-- ============ ٢) سجلّ الاستهلاك يعرف ثمن كل عملية ============

alter table public.ai_usage
  add column if not exists credits integer not null default 1;

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('quiz', 'summary', 'format', 'design', 'poster', 'tts'));

-- ============ ٣) الإدارة ============

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

/*
 * الجدول **مغلقٌ تماماً على واجهة REST**: لا سياسة قراءة ولا كتابة، ولا
 * منحة لأيّ دور. الوصول الوحيد إليه عبر `is_admin()` وهي `security
 * definer`. إذ لو قُرئ الجدول من المتصفّح لصار كشفاً بأسماء من يملك
 * المنصّة — وهي أول قائمةٍ يطلبها مهاجم.
 */
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ============ ٤) الإنفاق — ذرّيٌّ وفي القاعدة ============

/*
 * `spend_credits` تفعل الثلاثة في معاملةٍ واحدة: تتحقّق من الرصيد،
 * وتخصم، وتسجّل. والخصم `where credits >= n` في جملة UPDATE نفسها، فلا
 * تُفتح نافذةٌ بين القراءة والكتابة يمرّ منها طلبان متزامنان برصيدٍ
 * واحد. وترجع الباقي، أو -1 إن لم يكفِ الرصيد.
 *
 * وهي `security definer` **لأن العمود محجوبٌ عن المعلّم عمداً** (أعلاه):
 * هذا هو الطريق الوحيد المسموح لتغييره، ولا يقبل إلا أنواعاً معروفة
 * وعدداً موجباً محدوداً.
 */
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
  if k not in ('quiz', 'summary', 'format', 'design', 'poster', 'tts') then
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

revoke all on function public.spend_credits(integer, text) from public, anon;
grant execute on function public.spend_credits(integer, text) to authenticated;

/*
 * الإدارة تضبط الرصيد ضبطاً مطلقاً (لا بالزيادة فقط): «امنح ٥٠» و«صفّر»
 * حالتان تحتاجهما اللوحة معاً. والحدّ الأعلى يمنع خطأً في خانةٍ من أن
 * يفتح باباً بلا قاع.
 */
create or replace function public.admin_set_credits(t_id uuid, n integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  left_over integer;
begin
  if not is_admin() then
    raise exception 'not admin';
  end if;
  if n is null or n < 0 or n > 100000 then
    raise exception 'bad amount';
  end if;

  update teachers set credits = n where id = t_id
  returning credits into left_over;

  return coalesce(left_over, -1);
end;
$$;

revoke all on function public.admin_set_credits(uuid, integer) from public, anon;
grant execute on function public.admin_set_credits(uuid, integer) to authenticated;

/*
 * قائمة المعلّمين للوحة الإدارة — دالّةٌ لا سياسة قراءة.
 *
 * `teachers` مقروءٌ للجميع أصلاً (المنشور منه)، لكن البريد الإلكتروني في
 * `auth.users` ليس كذلك ولا يجوز أن يصير كذلك. فتُجمع البيانات هنا خلف
 * `is_admin()` بدل فتح أيّ منها على الواجهة.
 */
create or replace function public.admin_teacher_list()
returns table (
  id uuid,
  name text,
  slug text,
  subject text,
  email text,
  credits integer,
  used_credits bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.slug, t.subject,
         coalesce(u.email, '')::text as email,
         t.credits,
         coalesce((select sum(a.credits) from ai_usage a where a.teacher_id = t.id), 0)::bigint,
         t.created_at
    from teachers t
    left join auth.users u on u.id = t.owner_id
   where is_admin()
   order by t.created_at desc;
$$;

revoke all on function public.admin_teacher_list() from public, anon;
grant execute on function public.admin_teacher_list() to authenticated;

-- ============ ٥) الملصقات والبطاقات المولَّدة ============

create table if not exists public.lesson_posters (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete set null,
  kind       text not null default 'poster'
             check (kind in ('poster', 'card', 'diagram')),
  title      text not null default '',
  topic      text not null default '',
  image_url  text not null,
  created_at timestamptz not null default now()
);

create index if not exists lesson_posters_teacher_idx
  on public.lesson_posters (teacher_id, created_at desc);
create index if not exists lesson_posters_lesson_idx
  on public.lesson_posters (lesson_id);

alter table public.lesson_posters enable row level security;

create policy "posters_owner" on public.lesson_posters
  for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = lesson_posters.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = lesson_posters.teacher_id and t.owner_id = auth.uid())
  );

revoke all on public.lesson_posters from anon;
grant select, insert, update, delete on public.lesson_posters to authenticated;

/*
 * الردّ — حين يفشل نداء النموذج بعد الخصم.
 *
 * الخصم يقع **قبل** النداء عمداً (وإلا استُدعي النموذج بلا حساب بقطع
 * الطلب)، فلا بدّ من طريقٍ للردّ وإلا دفع المعلّم ثمن عطلٍ ليس منه.
 * ويُسجَّل سطراً سالباً لا بمحو الخصم: السجلّ قصّةٌ تُقرأ لا رصيدٌ يُعدَّل.
 */
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
  if k not in ('quiz', 'summary', 'format', 'design', 'poster', 'tts') then
    raise exception 'bad kind';
  end if;

  select id into t_id from teachers where owner_id = auth.uid();
  if t_id is null then
    return -1;
  end if;

  /*
   * لا يُردّ إلا ما خُصم فعلاً في الدقائق الأخيرة: بغير هذا الشرط تصير
   * الدالّة صنبورَ رصيدٍ مفتوحاً يستدعيه أيّ معلّم من REST بلا نداءٍ
   * فاشل أصلاً.
   */
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

revoke all on function public.refund_credits(integer, text) from public, anon;
grant execute on function public.refund_credits(integer, text) to authenticated;
