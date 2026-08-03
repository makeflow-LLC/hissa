-- ============================================================
-- «سمِّ الأجزاء» (labeling) — اللعبة الثانية عشرة
-- ============================================================
--
-- المعلّم يرفع صورةً واحدة (خريطة، جهاز هضمي، رسم بيانيّ، أجزاء نبات)
-- ويضع عليها نقاطاً، ولكل نقطة اسمها. والطالب يسحب الاسم إلى موضعه.
--
-- **هذه أول لعبة تحتاج صورةً للنشاط كلّه لا للعنصر الواحد**، فالصورة
-- عمودٌ على `activities` لا حقلٌ في `items`. أمّا موضع كل اسم (x, y)
-- فيسكن داخل عنصره في `items` بنسبة مئوية من عرض الصورة وارتفاعها —
-- بالنسبة لا بالبكسل، لتصحّ المواضع على كل مقاس شاشة.

alter table public.activities
  add column if not exists image_url text;

comment on column public.activities.image_url is
  'صورة النشاط الواحدة — تستعملها لعبة «سمِّ الأجزاء»؛ تُقصر في الشيفرة على مضيف المشروع.';

alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities
  add constraint activities_kind_check check (kind in (
    'match', 'flashcards', 'quiz', 'anagram', 'sort', 'wheel',
    'memory', 'truefalse', 'balloons', 'speed',
    'pyramid', 'labeling'
  ));
