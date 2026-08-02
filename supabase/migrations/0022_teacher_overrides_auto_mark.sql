-- ============================================================
-- المعلّم يصحّح ما أخطأ فيه التصحيح الآلي
-- ============================================================
--
-- التصحيح الآلي لا يخطئ في الحساب، لكنّه يصحّح على **المفتاح المخزَّن**:
-- فإن كان المفتاح نفسه خاطئاً — وقد كان يُفترَض افتراضاً قبل هذه النسخة،
-- «الخيار الأول صحيح» — خرجت العلامة خاطئة وهي مطابقة للقاعدة.
--
-- وأسئلة الاختبار تُقفل بمجرّد أن يبدأ طالبٌ واحد (وهذا صحيح: تغييرها
-- بعد الإجابة يعيد تصحيح الطلاب على أسئلةٍ غير التي رأوها)، فلم يكن أمام
-- المعلّم أي طريق لتصويب علامةٍ يعرف أنها خاطئة.
--
-- `recalc_attempt_score` كانت تجمع `awarded` لأسئلة `text` وحدها وتترك
-- `auto_score` كما كتبه التصحيح — فلو عدّل المعلّم علامة سؤال اختيارٍ
-- من متعدّد لتغيّر الصفّ ولم يتغيّر المجموع، وهو أسوأ من منع التعديل.
-- صارت تُعيد بناء الطرفين من `exam_answers`، فتعديل أي إجابة ينعكس.

create or replace function public.recalc_attempt_score(a_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  att     exam_attempts%rowtype;
  autos   numeric := 0;
  manual  numeric := 0;
  pending int := 0;
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

  -- الموضوعية: مجموع ما استقرّ في الإجابات، لا ما كتبه التصحيح أوّل مرّة
  select coalesce(sum(a.awarded), 0) into autos
  from exam_answers a
  join exam_questions q on q.id = a.question_id
  where a.attempt_id = a_id and q.kind <> 'text';

  select coalesce(sum(a.awarded), 0) into manual
  from exam_answers a
  join exam_questions q on q.id = a.question_id
  where a.attempt_id = a_id and q.kind = 'text';

  select count(*) into pending
  from exam_answers a
  join exam_questions q on q.id = a.question_id
  where a.attempt_id = a_id and q.kind = 'text' and a.graded = false;

  update exam_attempts
     set auto_score   = autos,
         manual_score = manual,
         status = case when pending = 0 then 'graded' else 'submitted' end
   where id = a_id;
end;
$$;

comment on function public.recalc_attempt_score(uuid) is
  'يعيد بناء علامتَي المحاولة من الإجابات — فتنعكس تصويبات المعلّم للأسئلة الموضوعية أيضاً.';
