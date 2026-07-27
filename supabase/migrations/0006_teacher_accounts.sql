-- ============================================================
-- حسابات المعلّمين الحقيقية + حقول الملف الاحترافي
-- (مطبّقة فعلاً على المشروع: mexpmtuqhvnphgeqqjuf)
-- ============================================================

alter table public.teachers
  add column if not exists qualification    text    not null default '',
  add column if not exists experience_years  integer not null default 0,
  add column if not exists is_published      boolean not null default true;

-- المعلّم ينشئ صف بروفايله المملوك له
drop policy if exists "teachers_owner_insert" on public.teachers;
create policy "teachers_owner_insert"
  on public.teachers for insert
  with check (owner_id = auth.uid());

-- القراءة العامة: المنشور للجميع، وغير المنشور لمالكه فقط
drop policy if exists "teachers_public_read" on public.teachers;
create policy "teachers_public_read"
  on public.teachers for select
  using (is_published or owner_id = auth.uid());

-- تزويد المعلّمين الحاليين ببيانات مؤهل وخبرة تجريبية
update public.teachers set
  qualification = case subject
    when 'رياضيات' then 'بكالوريوس رياضيات — كلية العلوم'
    when 'لغة عربية' then 'ليسانس لغة عربية — كلية الآداب'
    when 'علوم' then 'بكالوريوس علوم وتربية'
    when 'لغة إنجليزية' then 'ليسانس ترجمة + شهادة CELTA'
    when 'دراسات اجتماعية' then 'ليسانس جغرافيا وتاريخ'
    else 'مؤهل تربوي معتمد'
  end,
  experience_years = 8 + (rating_count % 12)
where qualification = '';
