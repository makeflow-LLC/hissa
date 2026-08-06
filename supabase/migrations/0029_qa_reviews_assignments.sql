-- ------------------------------------------------------------
-- 0029 — خمس ميزات: بنك الأسئلة، المراجعة المتباعدة، الواجبات،
--        ولوحة التشخيص والنقاط (كلتاهما **مشتقّتان** بلا جداول جديدة).
-- ------------------------------------------------------------

-- ============ مساعدات مشتركة ============

/*
 * مالك الدرس، بدالّة `security definer`.
 *
 * السياسات تحتاج أن تعرف معلّم الدرس، وقراءة `lessons` من داخل سياسةٍ
 * أخرى تمرّ بسياسات `lessons` نفسها — فالدرس المسودّة أو المقيَّد يعود
 * فارغاً فتنهار السياسة المبنيّة عليه. والدالّة تتجاوز ذلك، ولا تكشف
 * شيئاً: معرّف المعلّم معروفٌ أصلاً لكل من يرى الدرس.
 */
create or replace function public.lesson_owner(l_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select teacher_id from lessons where id = l_id;
$$;

/** هل المستدعي طالبٌ قَبِله هذا المعلّم؟ — الشرط نفسه في كل مكان */
create or replace function public.is_approved_of(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from follows f
    where f.teacher_id = t_id
      and f.student_id = auth.uid()
      and f.status = 'approved'
  );
$$;

revoke all on function public.lesson_owner(uuid)    from public, anon;
revoke all on function public.is_approved_of(uuid)  from public, anon;
grant execute on function public.lesson_owner(uuid)   to authenticated;
grant execute on function public.is_approved_of(uuid) to authenticated;

-- ============ ١) بنك الأسئلة ============

/*
 * سؤالٌ يُسأل مرّةً ويُجاب مرّة.
 *
 * اليوم يسأل الطالب في الرسائل الخاصّة، فيجيب المعلّم، ثم يسأل غيره
 * السؤال نفسه بعد ساعة — فيُجاب السؤال الواحد عشرين مرّة. وهنا يُنشر
 * الجواب تحت الدرس، فيقرؤه كل من يأتي بعده.
 */
create table if not exists public.lesson_questions (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id)  on delete cascade,
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  student_id  uuid not null references auth.users (id)      on delete cascade,
  body        text not null,
  answer      text not null default '',
  answered_at timestamptz,
  /** المعلّم يخفي سؤالاً لا يصلح للنشر دون أن يحذفه */
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists lesson_questions_lesson_idx
  on public.lesson_questions (lesson_id, created_at desc);
create index if not exists lesson_questions_teacher_idx
  on public.lesson_questions (teacher_id, answered_at nulls first, created_at desc);

alter table public.lesson_questions enable row level security;

/*
 * الطالب يقرأ **المُجاب** من أسئلة غيره، و**كلّ** أسئلته هو.
 *
 * ولولا شرط الإجابة لصارت صفحة الدرس جداراً من الأسئلة المعلّقة، ولانكشف
 * لكل زميلٍ ما لم يفهمه زميله قبل أن يصل جوابٌ يفيده.
 */
create policy "questions_student_read" on public.lesson_questions
  for select to authenticated
  using (
    student_id = auth.uid()
    or (
      not hidden
      and answered_at is not null
      and public.is_approved_of(teacher_id)
    )
  );

create policy "questions_student_ask" on public.lesson_questions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.is_approved_of(teacher_id)
    and teacher_id = public.lesson_owner(lesson_id)
    -- المعلّم لا يسأل نفسه: الدورين متعارضان في هذه المنصّة
    and not exists (select 1 from teachers t where t.owner_id = auth.uid())
  );

/** يحذف الطالب سؤاله ما دام لم يُجَب — بعد الجواب صار ملكاً للصفّ */
create policy "questions_student_delete" on public.lesson_questions
  for delete to authenticated
  using (student_id = auth.uid() and answered_at is null);

create policy "questions_teacher_all" on public.lesson_questions
  for all to authenticated
  using (
    exists (select 1 from teachers t
            where t.id = lesson_questions.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from teachers t
            where t.id = lesson_questions.teacher_id and t.owner_id = auth.uid())
  );

/** «عندي نفس السؤال» — يرفع السؤال في ترتيب المعلّم بدل تكراره */
create table if not exists public.question_votes (
  question_id uuid not null references public.lesson_questions (id) on delete cascade,
  student_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, student_id)
);

alter table public.question_votes enable row level security;

create policy "votes_own" on public.question_votes
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

/** المعلّم يقرأ أصوات أسئلته ليعرف أيّها أكثر إلحاحاً */
create policy "votes_teacher_read" on public.question_votes
  for select to authenticated
  using (
    exists (
      select 1 from lesson_questions q join teachers t on t.id = q.teacher_id
      where q.id = question_votes.question_id and t.owner_id = auth.uid()
    )
  );

revoke all on public.lesson_questions from anon;
revoke all on public.question_votes   from anon;
grant select, insert, update, delete on public.lesson_questions to authenticated;
grant select, insert, delete         on public.question_votes   to authenticated;

-- ============ ٢) المراجعة المتباعدة ============

/*
 * `lesson_progress` يسجّل «أنهى الدرس» ثم يُنسى الدرس إلى الأبد. وهذا
 * الجدول يعيده: بعد ثلاثة أيام، ثم سبعة، ثم واحدٍ وعشرين، ثم ستّين.
 *
 * والصفّ ملكُ الطالب يكتبه بنفسه — فمن يعبث بمواعيده لا يغشّ إلا نفسه،
 * ولا شيء هنا يدخل في علامةٍ ولا يراه معلّم.
 */
create table if not exists public.lesson_reviews (
  student_id  uuid not null references auth.users (id)   on delete cascade,
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  /** رقم المحطّة في سلّم التباعد: 0 → 3 أيام، 1 → 7، 2 → 21، 3 → 60 */
  stage       smallint not null default 0,
  due_at      timestamptz not null default now(),
  last_result smallint,
  reviewed_at timestamptz,
  primary key (student_id, lesson_id)
);

create index if not exists lesson_reviews_due_idx
  on public.lesson_reviews (student_id, due_at);

alter table public.lesson_reviews enable row level security;

create policy "reviews_own" on public.lesson_reviews
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

revoke all on public.lesson_reviews from anon;
grant select, insert, update, delete on public.lesson_reviews to authenticated;

-- ============ ٣) الواجبات ============

/*
 * الواجب اليوم جملةٌ داخل نصّ الدرس: لا موعد، ولا تسليم، ولا يعرف
 * المعلّم من عمله. وهنا يصير كياناً له موعدٌ وتسليمٌ ولوحة.
 *
 * و`group_id` يقبل `null` = كل الطلاب المقبولين — كالأنشطة لا كالاختبارات:
 * الواجب تدريبٌ يتّسع، والاختبار قياسٌ يُوجَّه.
 */
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  group_id    uuid references public.student_groups (id) on delete set null,
  lesson_id   uuid references public.lessons (id) on delete set null,
  title       text not null,
  body        text not null default '',
  due_at      timestamptz,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now()
);

create index if not exists assignments_teacher_idx
  on public.assignments (teacher_id, created_at desc);

alter table public.assignments enable row level security;

create policy "assignments_teacher_all" on public.assignments
  for all to authenticated
  using (
    exists (select 1 from teachers t
            where t.id = assignments.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from teachers t
            where t.id = assignments.teacher_id and t.owner_id = auth.uid())
    and (
      group_id is null
      or exists (select 1 from student_groups g
                 where g.id = assignments.group_id and g.teacher_id = assignments.teacher_id)
    )
  );

/** المسودّة لا تصل طالباً — كالدروس والاختبارات والأنشطة تماماً */
create policy "assignments_student_read" on public.assignments
  for select to authenticated
  using (
    status = 'published'
    and (
      (group_id is not null and public.is_group_member(group_id, auth.uid()))
      or (group_id is null and public.is_approved_of(teacher_id))
    )
  );

create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references auth.users (id) on delete cascade,
  body          text not null default '',
  file_url      text,
  submitted_at  timestamptz not null default now(),
  /** تصحيح المعلّم — نصٌّ وعلامة اختيارية، لا تدخل أي معدّل */
  grade         numeric,
  feedback      text not null default '',
  graded_at     timestamptz,
  unique (assignment_id, student_id)
);

create index if not exists submissions_assignment_idx
  on public.assignment_submissions (assignment_id, submitted_at desc);

alter table public.assignment_submissions enable row level security;

/*
 * الطالب يقرأ ويكتب تسليمه هو وحده — ولا يعدّله بعد التصحيح، وإلا غيّر
 * ما بُني عليه تقدير المعلّم.
 */
create policy "submissions_student_read" on public.assignment_submissions
  for select to authenticated
  using (student_id = auth.uid());

create policy "submissions_student_write" on public.assignment_submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from assignments a
      where a.id = assignment_id
        and a.status = 'published'
        and (
          (a.group_id is not null and public.is_group_member(a.group_id, auth.uid()))
          or (a.group_id is null and public.is_approved_of(a.teacher_id))
        )
    )
  );

create policy "submissions_student_edit" on public.assignment_submissions
  for update to authenticated
  using (student_id = auth.uid() and graded_at is null)
  with check (student_id = auth.uid());

create policy "submissions_teacher" on public.assignment_submissions
  for all to authenticated
  using (
    exists (
      select 1 from assignments a join teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from assignments a join teachers t on t.id = a.teacher_id
      where a.id = assignment_submissions.assignment_id and t.owner_id = auth.uid()
    )
  );

revoke all on public.assignments            from anon;
revoke all on public.assignment_submissions from anon;
grant select, insert, update, delete on public.assignments            to authenticated;
grant select, insert, update, delete on public.assignment_submissions to authenticated;

/*
 * **العلامة والملاحظة محجوبتان عن الطالب في الكتابة.**
 *
 * سياسة `submissions_student_edit` تسمح له بتعديل صفّه ما لم يُصحَّح،
 * وRLS يرشّح الصفوف لا الأعمدة — فبدون هذا الحاجز يستطيع أن يرسل PATCH
 * يضع فيه `grade` لنفسه. نفس أسلوب حجب `credits` في 0026.
 *
 * و**الإسقاط إلزاميّ لا احتياطيّ**: Supabase يمنح ALL على كل جدولٍ جديد
 * افتراضياً، فمنحة الأعمدة وحدها لا تفعل شيئاً ما دامت منحة الجدول
 * قائمة. أسقطها اختبارُ تبديل الأدوار هنا قبل الإطلاق — كان الطالب
 * يضع علامته بنفسه.
 */
revoke update on public.assignment_submissions from authenticated, anon;
grant update (body, file_url, submitted_at) on public.assignment_submissions to authenticated;

/*
 * والمعلّم يحتاج الأعمدة كلّها. ومنحُها لدورٍ واحد غير ممكن — الدور
 * `authenticated` يشمل الطرفين — فيمرّ تصحيحه بدالّةٍ `security definer`
 * تتحقّق أنه صاحب الواجب.
 */
create or replace function public.grade_submission(
  s_id uuid, g numeric, note text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare owns boolean;
begin
  select exists (
    select 1 from assignment_submissions s
    join assignments a on a.id = s.assignment_id
    join teachers t    on t.id = a.teacher_id
    where s.id = s_id and t.owner_id = auth.uid()
  ) into owns;
  if not owns then
    return false;
  end if;

  update assignment_submissions
     set grade     = g,
         feedback  = coalesce(left(note, 2000), ''),
         graded_at = now()
   where id = s_id;
  return true;
end;
$$;

revoke all on function public.grade_submission(uuid, numeric, text) from public, anon;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

-- ============ ٤) النقاط — مشتقّة لا مخزّنة ============

/*
 * **لا سجلّ نقاط ولا جدول.**
 *
 * أيّ جدولٍ يكتب فيه الطالب نقاطه بابُ غشٍّ يحتاج حارساً؛ وأيّ دالّةٍ
 * تكتبها له تحتاج أن تتحقّق من الفعل الذي تكافئه — أي أن تقرأ الجداول
 * نفسها. فنقرؤها مباشرةً ونحسب: النتيجة غير قابلة للتزوير بحكم بنائها،
 * ولا تحتاج مزامنةً ولا تنظيفاً، ولا تتناقض مع الواقع أبداً.
 */
create or replace function public.student_points(s_id uuid default null)
returns table (
  lessons_done   bigint,
  activities     bigint,
  exams_done     bigint,
  reviews_done   bigint,
  on_time        bigint,
  points         bigint,
  streak_days    integer,
  active_days    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select coalesce(s_id, auth.uid()) as uid),
  days as (
    select distinct date_trunc('day', d)::date as day from (
      select lp.completed_at as d from lesson_progress lp, me where lp.student_id = me.uid
      union all
      select ap.played_at    from activity_plays ap, me where ap.student_id = me.uid
      union all
      select ea.submitted_at from exam_attempts ea, me
        where ea.student_id = me.uid and ea.submitted_at is not null
      union all
      select lr.reviewed_at  from lesson_reviews lr, me
        where lr.student_id = me.uid and lr.reviewed_at is not null
      union all
      select s.submitted_at  from assignment_submissions s, me where s.student_id = me.uid
    ) t where d is not null
  ),
  -- السلسلة: كم يوماً متتالياً حتى اليوم (أو أمس، فاليوم قد لم يبدأ بعد)
  streak as (
    select count(*)::int as n from (
      select day, row_number() over (order by day desc) as rn from days
       where day <= current_date
    ) x
    where x.day = current_date - ((x.rn - 1)::int)
      and exists (select 1 from days where day >= current_date - 1)
  ),
  c as (
    select
      (select count(*) from lesson_progress lp, me where lp.student_id = me.uid) as l,
      (select count(*) from activity_plays  ap, me where ap.student_id = me.uid) as a,
      (select count(*) from exam_attempts   ea, me
        where ea.student_id = me.uid and ea.status in ('submitted','graded'))    as e,
      (select count(*) from lesson_reviews  lr, me
        where lr.student_id = me.uid and lr.reviewed_at is not null)             as r,
      (select count(*) from assignment_submissions s
         join assignments ag on ag.id = s.assignment_id, me
        where s.student_id = me.uid
          and (ag.due_at is null or s.submitted_at <= ag.due_at))                as o
  )
  select c.l, c.a, c.e, c.r, c.o,
         -- الأوزان: المراجعة والواجب في موعده أثقل من فتح درس
         (c.l * 10 + c.a * 5 + c.e * 20 + c.r * 15 + c.o * 25)::bigint,
         coalesce((select n from streak), 0),
         (select count(*) from days)
    from c;
$$;

revoke all on function public.student_points(uuid) from public, anon;
grant execute on function public.student_points(uuid) to authenticated;

-- ============ ٥) لوحة التشخيص — مشتقّة كذلك ============

/*
 * أصعب أسئلة معلّمٍ بعينه: كم طالباً أخطأها ومن أي اختبار.
 *
 * `security definer` لأن الحساب يعبر `exam_answers` و`exam_questions`،
 * وسياساتهما — عن حقّ — لا تُظهر للمعلّم صفوفاً مجمّعةً عبر الطلاب بهذه
 * الصورة. والدالّة تشترط ملكيّته للاختبار، فلا تكشف اختبار غيره.
 */
create or replace function public.teacher_hard_questions(top integer default 10)
returns table (
  exam_id     uuid,
  exam_title  text,
  question_id uuid,
  prompt      text,
  answered    bigint,
  wrong       bigint,
  wrong_pct   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, q.id, q.prompt,
         count(*)::bigint,
         count(*) filter (where coalesce(an.awarded, 0) < q.points)::bigint,
         round(
           100.0 * count(*) filter (where coalesce(an.awarded, 0) < q.points)
           / greatest(count(*), 1)
         )::int
    from exam_answers an
    join exam_questions q on q.id = an.question_id
    join exams e          on e.id = q.exam_id
    join teachers t       on t.id = e.teacher_id
    join exam_attempts at on at.id = an.attempt_id
   where t.owner_id = auth.uid()
     and at.status in ('submitted', 'graded')
     and an.graded = true
   group by e.id, e.title, q.id, q.prompt
  having count(*) >= 2
   order by 7 desc, 5 desc
   limit greatest(1, least(coalesce(top, 10), 50));
$$;

revoke all on function public.teacher_hard_questions(integer) from public, anon;
grant execute on function public.teacher_hard_questions(integer) to authenticated;

/*
 * الطلاب الغائبون: من لم يفعل شيئاً منذ مدّة.
 *
 * أهمّ رقمٍ في لوحة المعلّم وأقلّه ظهوراً: الطالب المتعثّر لا يشكو،
 * يختفي فقط. والدالّة تعدّه من آخر أثرٍ له في أي جدول نشاط.
 */
create or replace function public.teacher_quiet_students(days integer default 14)
returns table (
  student_id uuid,
  name       text,
  grade      text,
  last_seen  timestamptz,
  quiet_days integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select f.student_id
      from follows f join teachers t on t.id = f.teacher_id
     where t.owner_id = auth.uid() and f.status = 'approved'
  ),
  last_act as (
    select m.student_id, max(acts.d) as seen from mine m
    left join lateral (
      select lp.completed_at as d from lesson_progress lp where lp.student_id = m.student_id
      union all
      select ap.played_at    from activity_plays ap where ap.student_id = m.student_id
      union all
      select ea.submitted_at from exam_attempts ea where ea.student_id = m.student_id
      union all
      select s.submitted_at  from assignment_submissions s where s.student_id = m.student_id
    ) acts on true
    group by m.student_id
  )
  select la.student_id,
         coalesce(p.full_name, 'طالب')::text,
         coalesce(p.grade, '')::text,
         la.seen,
         case when la.seen is null then 9999
              else extract(day from now() - la.seen)::int end
    from last_act la
    left join profiles p on p.id = la.student_id
   where la.seen is null
      or la.seen < now() - make_interval(days => greatest(1, least(coalesce(days, 14), 365)))
   order by la.seen nulls first
   limit 100;
$$;

revoke all on function public.teacher_quiet_students(integer) from public, anon;
grant execute on function public.teacher_quiet_students(integer) to authenticated;

/*
 * الدروس التي يتوقّف عندها الصفّ: كم من طلابك أنهى كل درس.
 * نسبةٌ منخفضة في درسٍ بعينه تقول «أعِد شرحه» أوضح من أي علامة.
 */
create or replace function public.teacher_lesson_reach()
returns table (
  lesson_id uuid,
  title     text,
  unit      text,
  done      bigint,
  students  bigint,
  pct       integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select t.id as tid,
           (select count(*) from follows f
             where f.teacher_id = t.id and f.status = 'approved') as n
      from teachers t where t.owner_id = auth.uid()
  )
  select l.id, l.title, coalesce(u.title, '—')::text,
         (select count(*) from lesson_progress lp
            join follows f on f.student_id = lp.student_id and f.teacher_id = mine.tid
           where lp.lesson_id = l.id and f.status = 'approved')::bigint,
         mine.n::bigint,
         round(
           100.0 * (select count(*) from lesson_progress lp
                      join follows f on f.student_id = lp.student_id and f.teacher_id = mine.tid
                     where lp.lesson_id = l.id and f.status = 'approved')
           / greatest(mine.n, 1)
         )::int
    from lessons l
    cross join mine
    left join units u on u.id = l.unit_id
   where l.teacher_id = mine.tid and l.status = 'published'
   order by 6 asc, l.position
   limit 100;
$$;

revoke all on function public.teacher_lesson_reach() from public, anon;
grant execute on function public.teacher_lesson_reach() to authenticated;

-- ============ البثّ اللحظي ============

/*
 * الأسئلة والواجبات تدخل قناة الوقت الحقيقي كالرسائل: المعلّم يرى
 * السؤال لحظة وصوله، والطالب يرى الجواب دون أن يُحدّث الصفحة. وRLS هي
 * المرشِّح — لا يصل المشترك إلا صفٌّ يحقّ له قراءته أصلاً.
 */
do $$
begin
  begin
    alter publication supabase_realtime add table public.lesson_questions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.assignments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.assignment_submissions;
  exception when duplicate_object then null;
  end;
end $$;
