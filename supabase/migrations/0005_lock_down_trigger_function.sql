-- ============================================================
-- إحكام صلاحيات دوال SECURITY DEFINER
-- (مطبّقة فعلاً على المشروع: mexpmtuqhvnphgeqqjuf)
-- ============================================================

-- handle_new_user دالة مُشغّل (trigger) ولا يجوز مناداتها عبر REST API.
-- المُشغّل نفسه يعمل بصلاحيات مالك الجدول فلا يتأثر بسحب الصلاحية.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- get_free_preview_content تبقى متاحة للزائر بشكل مقصود: هي بوابة العيّنة
-- المجانية الوحيدة، ولا تُرجع إلا الصفوف المعلّمة is_free_preview = true.
-- مدقّق أمان Supabase ينبّه عليها، وهذا التنبيه متوقّع ومقبول هنا.
