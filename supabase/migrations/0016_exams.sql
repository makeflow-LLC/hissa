-- ============================================================
-- الاختبارات: مرتبطة بمجموعة، بنافذة زمنية، وتصحيح آلي ويدوي
-- ============================================================
--
-- يختلف الاختبار عن `quiz_questions` المرتبطة بدرس: هذا امتحان مستقلّ
-- يوجّهه المعلّم إلى **مجموعة بعينها**، يفتح ويغلق في وقت محدّد، ولكل
-- سؤال فيه علامته ونوعه. الأسئلة الموضوعية تُصحَّح آلياً، والنصّية
-- (علّل، اذكر السبب) يصحّحها المعلّم بنفسه.

-- ------------------------------------------------------------
-- ١) الاختبار
-- ------------------------------------------------------------
create table if not exists public.exams (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  -- المجموعة المستهدفة: لا يراه إلا أعضاؤها
  group_id    uuid not null references public.student_groups (id) on delete cascade,
  title       text not null,
  description text not null default '',
  opens_at    timestamptz,
  closes_at   timestamptz,
  /** مدّة الإجابة بالدقائق من لحظة البدء (فارغة = بلا حدّ) */
  duration_minutes int,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now()
);

create index if not exists exams_teacher_idx on public.exams (teacher_id, created_at desc);
create index if not exists exams_group_idx on public.exams (group_id, status);

-- ------------------------------------------------------------
-- ٢) الأسئلة
--
-- `answer` تحمل الإجابة الصحيحة حسب النوع: رقم الخيار للاختيار من
-- متعدّد، و true/false للصح والخطأ، ولا شيء للنصّي.
-- ------------------------------------------------------------
create table if not exists public.exam_questions (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams (id) on delete cascade,
  position      int not null default 0,
  kind          text not null check (kind in ('mcq', 'truefalse', 'text')),
  prompt        text not null,
  /** خيارات الاختيار من متعدّد */
  options       jsonb not null default '[]'::jsonb,
  correct_index int,
  correct_bool  boolean,
  /** إجابة نموذجية يستعين بها المعلّم عند التصحيح اليدوي */
  model_answer  text not null default '',
  points        numeric(6, 2) not null default 1 check (points > 0)
);

create index if not exists exam_questions_exam_idx
  on public.exam_questions (exam_id, position);

-- ------------------------------------------------------------
-- ٣) محاولة الطالب وإجاباته
-- ------------------------------------------------------------
create table if not exists public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams (id) on delete cascade,
  student_id   uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  /** submitted = بانتظار تصحيح نصّي، graded = اكتملت الدرجة */
  status       text not null default 'in_progress'
               check (status in ('in_progress', 'submitted', 'graded')),
  auto_score   numeric(7, 2) not null default 0,
  manual_score numeric(7, 2) not null default 0,
  max_score    numeric(7, 2) not null default 0,
  unique (exam_id, student_id)
);

create index if not exists exam_attempts_exam_idx
  on public.exam_attempts (exam_id, status);
create index if not exists exam_attempts_student_idx
  on public.exam_attempts (student_id);

create table if not exists public.exam_answers (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.exam_attempts (id) on delete cascade,
  question_id  uuid not null references public.exam_questions (id) on delete cascade,
  choice_index int,
  bool_answer  boolean,
  text_answer  text not null default '',
  awarded      numeric(6, 2) not null default 0,
  /** صحّحه المعلّم يدوياً؟ (الأسئلة النصّية فقط) */
  graded       boolean not null default false,
  unique (attempt_id, question_id)
);

create index if not exists exam_answers_attempt_idx
  on public.exam_answers (attempt_id);

-- ------------------------------------------------------------
-- ٤) الصلاحيات
--
-- **الأسئلة لا تُقرأ من الطالب مباشرةً أبداً.** لو منحناه SELECT على
-- exam_questions لقرأ correct_index من واجهة REST وأجاب كاملاً قبل أن
-- يبدأ. RLS ترشّح الصفوف لا الأعمدة، وامتيازات الأعمدة تفرّق بين الأدوار
-- (anon/authenticated) لا بين طالب ومعلّم — وكلاهما authenticated هنا.
-- فالمخرج الوحيد دالة security definer تعيد الأسئلة منزوعة الإجابات.
-- ------------------------------------------------------------
alter table public.exams          enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts  enable row level security;
alter table public.exam_answers   enable row level security;

/** هل يملك المستخدم الحالي هذا الاختبار؟ */
create or replace function public.owns_exam(e_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from exams e
    join teachers t on t.id = e.teacher_id
    where e.id = e_id and t.owner_id = auth.uid()
  );
$$;

/** هل الطالب الحالي عضو في مجموعة هذا الاختبار، والاختبار منشور؟ */
create or replace function public.can_take_exam(e_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from exams e
    join student_group_members m
      on m.group_id = e.group_id and m.student_id = auth.uid()
    where e.id = e_id and e.status = 'published'
  );
$$;

revoke all on function public.owns_exam(uuid) from public, anon;
revoke all on function public.can_take_exam(uuid) from public, anon;
grant execute on function public.owns_exam(uuid) to authenticated;
grant execute on function public.can_take_exam(uuid) to authenticated;

-- الاختبار: المعلّم يملك، والطالب يرى بيانات الاختبار (لا الأسئلة)
create policy "exams_teacher_all" on public.exams
  for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = exams.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = exams.teacher_id and t.owner_id = auth.uid())
    and exists (select 1 from public.student_groups g
                where g.id = exams.group_id and g.teacher_id = exams.teacher_id)
  );

create policy "exams_student_read" on public.exams
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.student_group_members m
      where m.group_id = exams.group_id and m.student_id = auth.uid()
    )
  );

-- الأسئلة: للمعلّم وحده. الطالب يمرّ عبر get_exam_paper() فقط.
create policy "exam_questions_teacher_all" on public.exam_questions
  for all to authenticated
  using (public.owns_exam(exam_questions.exam_id))
  with check (public.owns_exam(exam_questions.exam_id));

-- المحاولة: الطالب يفتح محاولته ويحدّثها، والمعلّم يقرأ ويصحّح
create policy "attempts_student_own" on public.exam_attempts
  for select to authenticated
  using (student_id = auth.uid());

create policy "attempts_student_start" on public.exam_attempts
  for insert to authenticated
  with check (student_id = auth.uid() and public.can_take_exam(exam_id));

create policy "attempts_teacher_read" on public.exam_attempts
  for select to authenticated
  using (public.owns_exam(exam_attempts.exam_id));

create policy "attempts_teacher_grade" on public.exam_attempts
  for update to authenticated
  using (public.owns_exam(exam_attempts.exam_id))
  with check (public.owns_exam(exam_attempts.exam_id));

-- الإجابات: الطالب يقرأ إجاباته، والمعلّم يقرأ ويصحّح إجابات اختباره
create policy "answers_student_read" on public.exam_answers
  for select to authenticated
  using (
    exists (select 1 from public.exam_attempts a
            where a.id = exam_answers.attempt_id and a.student_id = auth.uid())
  );

create policy "answers_teacher_all" on public.exam_answers
  for all to authenticated
  using (
    exists (select 1 from public.exam_attempts a
            where a.id = exam_answers.attempt_id and public.owns_exam(a.exam_id))
  )
  with check (
    exists (select 1 from public.exam_attempts a
            where a.id = exam_answers.attempt_id and public.owns_exam(a.exam_id))
  );

revoke all on public.exams          from anon;
revoke all on public.exam_questions from anon;
revoke all on public.exam_attempts  from anon;
revoke all on public.exam_answers   from anon;

grant select, insert, update, delete on public.exams          to authenticated;
grant select, insert, update, delete on public.exam_questions to authenticated;
grant select, insert, update, delete on public.exam_attempts  to authenticated;
grant select, insert, update, delete on public.exam_answers   to authenticated;

-- ------------------------------------------------------------
-- ٥) ورقة الأسئلة كما يراها الطالب — بلا إجابات
-- ------------------------------------------------------------
create or replace function public.get_exam_paper(e_id uuid)
returns table (
  id         uuid,
  "position" int,
  kind       text,
  prompt     text,
  options    jsonb,
  points     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.position, q.kind, q.prompt, q.options, q.points
  from exam_questions q
  where q.exam_id = e_id
    and (public.can_take_exam(e_id) or public.owns_exam(e_id))
  order by q.position;
$$;

revoke all on function public.get_exam_paper(uuid) from public, anon;
grant execute on function public.get_exam_paper(uuid) to authenticated;

comment on function public.get_exam_paper(uuid) is
  'أسئلة الاختبار بلا الإجابات الصحيحة — المنفذ الوحيد للطالب إليها.';

-- ------------------------------------------------------------
-- ٦) التصحيح داخل قاعدة البيانات
--
-- الطالب لا يقرأ الإجابات الصحيحة، ومع ذلك تُصحَّح إجابته:
-- security definer هو ما يتيح ذلك دون كشف الجدول له. ولو صحّحنا في
-- المتصفّح ووثقنا بدرجة يرسلها، لسلّم كل طالب علامة تامّة.
-- ------------------------------------------------------------
create or replace function public.grade_exam_attempt(a_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  att        exam_attempts%rowtype;
  item       jsonb;
  q          exam_questions%rowtype;
  auto       numeric := 0;
  max_pts    numeric := 0;
  has_manual boolean := false;
begin
  select * into att from exam_attempts where id = a_id;
  if not found then
    raise exception 'attempt not found';
  end if;

  -- المحاولة للطالب صاحب الجلسة وحده، وما زالت جارية
  if att.student_id <> auth.uid() then
    raise exception 'not your attempt';
  end if;
  if att.status <> 'in_progress' then
    raise exception 'already submitted';
  end if;

  -- مجموع علامات الاختبار من الأسئلة نفسها
  select coalesce(sum(points), 0) into max_pts
  from exam_questions where exam_id = att.exam_id;

  for item in select * from jsonb_array_elements(payload)
  loop
    select * into q
    from exam_questions
    where id = (item->>'question_id')::uuid
      and exam_id = att.exam_id;      -- سؤال من هذا الاختبار فقط
    if not found then
      continue;
    end if;

    if q.kind = 'mcq' then
      declare ci int := nullif(item->>'choice_index','')::int;
      begin
        if ci is not null and ci = q.correct_index then
          auto := auto + q.points;
          insert into exam_answers (attempt_id, question_id, choice_index, awarded, graded)
          values (a_id, q.id, ci, q.points, true)
          on conflict (attempt_id, question_id)
          do update set choice_index = excluded.choice_index,
                        awarded = excluded.awarded, graded = true;
        else
          insert into exam_answers (attempt_id, question_id, choice_index, awarded, graded)
          values (a_id, q.id, ci, 0, true)
          on conflict (attempt_id, question_id)
          do update set choice_index = excluded.choice_index, awarded = 0, graded = true;
        end if;
      end;

    elsif q.kind = 'truefalse' then
      declare ba boolean := nullif(item->>'bool_answer','')::boolean;
      begin
        if ba is not null and ba = q.correct_bool then
          auto := auto + q.points;
          insert into exam_answers (attempt_id, question_id, bool_answer, awarded, graded)
          values (a_id, q.id, ba, q.points, true)
          on conflict (attempt_id, question_id)
          do update set bool_answer = excluded.bool_answer,
                        awarded = excluded.awarded, graded = true;
        else
          insert into exam_answers (attempt_id, question_id, bool_answer, awarded, graded)
          values (a_id, q.id, ba, 0, true)
          on conflict (attempt_id, question_id)
          do update set bool_answer = excluded.bool_answer, awarded = 0, graded = true;
        end if;
      end;

    else
      -- نصّي: يُحفظ بلا علامة، وينتظر تصحيح المعلّم
      has_manual := true;
      insert into exam_answers (attempt_id, question_id, text_answer, awarded, graded)
      values (a_id, q.id, coalesce(item->>'text_answer',''), 0, false)
      on conflict (attempt_id, question_id)
      do update set text_answer = excluded.text_answer, awarded = 0, graded = false;
    end if;
  end loop;

  update exam_attempts
     set auto_score = auto,
         manual_score = 0,
         max_score = max_pts,
         submitted_at = now(),
         status = case when has_manual then 'submitted' else 'graded' end
   where id = a_id;

  return jsonb_build_object(
    'auto_score', auto,
    'max_score', max_pts,
    'needs_manual', has_manual
  );
end;
$$;

/** إعادة احتساب مجموع المحاولة بعد كل علامة يمنحها المعلّم يدوياً */
create or replace function public.recalc_attempt_score(a_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  att      exam_attempts%rowtype;
  manual   numeric := 0;
  pending  int := 0;
begin
  select * into att from exam_attempts where id = a_id;
  if not found then
    raise exception 'attempt not found';
  end if;

  -- المعلّم صاحب الاختبار وحده يعيد الاحتساب
  if not exists (
    select 1 from exams e join teachers t on t.id = e.teacher_id
    where e.id = att.exam_id and t.owner_id = auth.uid()
  ) then
    raise exception 'not your exam';
  end if;

  select coalesce(sum(a.awarded), 0) into manual
  from exam_answers a
  join exam_questions q on q.id = a.question_id
  where a.attempt_id = a_id and q.kind = 'text';

  select count(*) into pending
  from exam_answers a
  join exam_questions q on q.id = a.question_id
  where a.attempt_id = a_id and q.kind = 'text' and a.graded = false;

  update exam_attempts
     set manual_score = manual,
         status = case when pending = 0 then 'graded' else 'submitted' end
   where id = a_id;
end;
$$;

revoke all on function public.grade_exam_attempt(uuid, jsonb) from public, anon;
revoke all on function public.recalc_attempt_score(uuid)      from public, anon;
grant execute on function public.grade_exam_attempt(uuid, jsonb) to authenticated;
grant execute on function public.recalc_attempt_score(uuid)      to authenticated;
