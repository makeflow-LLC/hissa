-- ============================================================
-- حجب محتوى الدرس عن الزائر على مستوى قاعدة البيانات
-- (مطبّقة فعلاً على المشروع: mexpmtuqhvnphgeqqjuf)
--
-- RLS تعمل على مستوى الصفوف لا الأعمدة، لذلك نستخدم صلاحيات
-- الأعمدة (column privileges): الزائر يقرأ بيانات الدرس الوصفية
-- فقط (عنوان/وصف/مدة)، ولا يصل إلى sections أو gallery أو
-- video_url. هذا يمنع تجاوز الواجهة والجلب المباشر من الـ API.
-- ============================================================

revoke select on public.lessons from anon;
grant select (
  id, teacher_id, unit_id, status, title, description,
  duration, emoji, gradient, position, is_free_preview, created_at
) on public.lessons to anon;

-- الطالب المسجّل يرى الدرس كاملاً
grant select on public.lessons to authenticated;

-- المرفقات وأسئلة الاختبار للمسجّلين فقط
drop policy if exists "attachments_read" on public.lesson_attachments;
create policy "attachments_read_authenticated" on public.lesson_attachments
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_attachments.lesson_id and l.status = 'published'
    )
  );

drop policy if exists "quiz_read" on public.quiz_questions;
create policy "quiz_read_authenticated" on public.quiz_questions
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.lessons l
      where l.id = quiz_questions.lesson_id and l.status = 'published'
    )
  );

-- محتوى العيّنة المجانية: الطريق الوحيد لوصول الزائر لمحتوى درس،
-- ويعيد الصفوف المعلّمة is_free_preview فقط
create or replace function public.get_free_preview_content(p_lesson_id uuid)
returns table (sections jsonb, gallery jsonb, video_url text)
language sql
stable
security definer
set search_path = public
as $$
  select l.sections, l.gallery, l.video_url
  from public.lessons l
  where l.id = p_lesson_id
    and l.is_free_preview = true
    and l.status = 'published';
$$;

grant execute on function public.get_free_preview_content(uuid) to anon, authenticated;
