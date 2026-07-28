-- ============================================================
-- محادثة ثنائية الاتجاه بين الطالب ومعلّمه
--
-- كانت الرسائل باتجاه واحد (معلّم ← طالب) فلا يستطيع الطالب أن يسأل.
-- نضيف عمود sender بدل جدول جديد، فيصير الصف الواحد رسالةً في خيط
-- واحد لكل (معلّم، طالب) ويبقى استعلام العرض بسيطاً.
-- ============================================================

alter table public.teacher_messages
  add column if not exists sender text not null default 'teacher'
  check (sender in ('teacher','student'));

create index if not exists teacher_messages_thread_idx
  on public.teacher_messages (teacher_id, student_id, created_at);

-- الطالب يكتب باسمه هو، لمعلّم يتابعه، وبصفة student فقط.
-- التعميم (student_id فارغ) يبقى حكراً على المعلّم عبر سياسته القائمة.
drop policy if exists "messages_student_write" on public.teacher_messages;
create policy "messages_student_write"
  on public.teacher_messages for insert to authenticated
  with check (
    sender = 'student'
    and student_id = auth.uid()
    and exists (
      select 1 from public.follows f
      where f.teacher_id = teacher_messages.teacher_id
        and f.student_id = auth.uid()
    )
    -- حساب المعلّم لا ينتحل صفة طالب (الدوران منفصلان)
    and not exists (
      select 1 from public.teachers t where t.owner_id = auth.uid()
    )
  );

drop policy if exists "messages_student_delete_own" on public.teacher_messages;
create policy "messages_student_delete_own"
  on public.teacher_messages for delete to authenticated
  using (sender = 'student' and student_id = auth.uid());
