-- ============================================================
-- ألعاب أكثر، ولوحة صدارة للنشاط
-- ============================================================
--
-- أربع ألعاب جديدة تُلعَب بنفس قائمة الأزواج التي أدخلها المعلّم مرّةً:
-- الذاكرة، وصح أو خطأ، والبالونات، وتحدّي السرعة. لا عمود جديد لها —
-- وهذا هو مكسب النموذج: اللعبة العاشرة لا تحتاج هجرةً إلا لتوسيع القيد.

alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities
  add constraint activities_kind_check check (kind in (
    'match', 'flashcards', 'quiz', 'anagram', 'sort', 'wheel',
    'memory', 'truefalse', 'balloons', 'speed'
  ));

-- ------------------------------------------------------------
-- لوحة صدارة النشاط
--
-- المنافسة تدفع التكرار، والتكرار هو التدريب. لكنّها **بإذن المعلّم**:
-- صفٌّ فيه متعثّر يرى اسمه آخر القائمة كل مرّة قد ينفر، فترك الخيار
-- للمعلّم أصدق من فرضه.
-- ------------------------------------------------------------
alter table public.activities
  add column if not exists show_leaderboard boolean not null default true;

/**
 * أفضل نتيجة لكل طالب في نشاط، مرتّبةً.
 *
 * `security definer` لأن سياسة `activity_plays` تقصر الطالب على لعباته
 * هو — وهذا صحيح: لا نفتح الجدول كلّه لقراءة مباشرة. الدالّة تعيد
 * الأفضل فقط، ولا تعمل إلا لمن يجوز له لعب النشاط أو يملكه، ولا تعمل
 * أصلاً إن أغلق المعلّم اللوحة.
 *
 * **الأفضلية بالنسبة لا بالعدد، وتُؤخذ من صفٍّ واحد.** «تحدّي السرعة»
 * مجموعه عدد ما ظهر في الستّين ثانية، فيختلف من لعبة لأخرى: من لعب
 * ٩ من ١٠ ثم ٤ من ٣٠ كان `max(score)=9` و`max(total)=30` فتُعرض له
 * «٩ من ٣٠» — نتيجةٌ لم تحدث قطّ. لذلك `distinct on` تختار صفّاً
 * بعينه وتأخذ طرفيه معاً.
 */
create or replace function public.activity_leaderboard(a_id uuid, top int default 10)
returns table (student_id uuid, name text, best numeric, total numeric, plays bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.student_id,
         coalesce(pr.full_name, 'طالب') as name,
         p.best,
         p.total,
         p.plays
  from (
    select distinct on (ap.student_id)
           ap.student_id,
           ap.score as best,
           ap.total,
           count(*) over (partition by ap.student_id) as plays,
           case when ap.total > 0 then ap.score::numeric / ap.total else 0 end as ratio
    from activity_plays ap
    join activities a on a.id = ap.activity_id
    where ap.activity_id = a_id
      and a.show_leaderboard
      and (public.can_play_activity(a_id) or public.owns_activity(a_id))
    order by ap.student_id,
             case when ap.total > 0 then ap.score::numeric / ap.total else 0 end desc,
             ap.score desc,
             ap.played_at asc
  ) p
  left join profiles pr on pr.id = p.student_id
  order by p.ratio desc, p.best desc, p.plays asc
  limit greatest(1, least(coalesce(top, 10), 50));
$$;

revoke all on function public.activity_leaderboard(uuid, int) from public, anon;
grant execute on function public.activity_leaderboard(uuid, int) to authenticated;

comment on function public.activity_leaderboard(uuid, int) is
  'أفضل نتيجة لكل طالب في نشاط — لمن يجوز له لعبه، وإن أذن المعلّم.';
