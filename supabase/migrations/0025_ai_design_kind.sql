-- ------------------------------------------------------------
-- 0025 — «مصمّم الدروس» نوعُ استهلاكٍ رابع في سجلّ الذكاء الاصطناعي
--
-- `ai_usage.kind` كان محصوراً في ('quiz','summary','format'). ومن دون
-- توسيعه يُرفض إدراج سطر التصميم، فيسقط التوليد **بعد** أن يكون النموذج
-- قد أُستدعي ودُفع ثمنه — أسوأ ترتيب ممكن: كلفةٌ بلا نتيجة ولا قيد.
-- ------------------------------------------------------------

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;

alter table public.ai_usage
  add constraint ai_usage_kind_check
  check (kind in ('quiz', 'summary', 'format', 'design'));
