-- ============================================================
-- مساحة تخزين صور الدروس (للمحرّر الغني)
--
-- المعلّم يرفع الصور داخل مجلد باسم معرّف حسابه فقط:
--   lesson-media/<auth.uid()>/<uuid>.<ext>
-- فلا يستطيع الكتابة فوق ملفات معلّم آخر ولا حذفها.
--
-- القراءة عامة: روابط الصور تظهر داخل عمود lessons.sections
-- المحجوب عن الزائر، والمسارات عشوائية (uuid)، لكن من يملك
-- الرابط يستطيع فتح الصورة. هذا مقبول هنا لأن المنصة مجانية
-- للطالب والبوابة غرضها تشجيع التسجيل لا حماية أسرار.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-media',
  'lesson-media',
  true,
  5242880, -- ٥ ميجابايت للصورة الواحدة
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- قراءة عامة لهذه الحاوية
drop policy if exists "lesson_media_public_read" on storage.objects;
create policy "lesson_media_public_read" on storage.objects
  for select
  using (bucket_id = 'lesson-media');

-- الرفع: المستخدم المسجّل داخل مجلده الخاص فقط
drop policy if exists "lesson_media_owner_insert" on storage.objects;
create policy "lesson_media_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- التعديل والحذف: صاحب المجلد فقط
drop policy if exists "lesson_media_owner_update" on storage.objects;
create policy "lesson_media_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "lesson_media_owner_delete" on storage.objects;
create policy "lesson_media_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
