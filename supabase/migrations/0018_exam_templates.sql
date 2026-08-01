-- ============================================================
-- قوالب الاختبارات
-- ============================================================
--
-- المعلّم يكتب نفس بنية الاختبار كل مرّة: خمسة أسئلة اختيار وسؤالان
-- نصّيان، بنفس العلامات والترتيب. القالب يحفظ هذه البنية مرّةً ليعيد
-- استعمالها، فيبقى عليه كتابة الأسئلة وحدها.
--
-- الأسئلة تُخزَّن `jsonb` لا في جدول أبناء: القالب لقطةٌ جامدة لا يشير
-- إليها اختبار قائم ولا تتغيّر بتغيّره، فجدولُ صفوفٍ منفصل يزيد التعقيد
-- بلا مقابل. وهو نفس ما يرسله `ExamBuilder` أصلاً.

create table if not exists public.exam_templates (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  name        text not null,
  description text not null default '',
  /** [{kind, prompt, options, correct_index, correct_bool, model_answer, points}] */
  questions   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists exam_templates_teacher_idx
  on public.exam_templates (teacher_id, created_at desc);

alter table public.exam_templates enable row level security;

-- القالب خاصّ بصاحبه: قد يحمل إجابات نموذجية وأسئلة لم تُنشر بعد
drop policy if exists "exam_templates_owner" on public.exam_templates;
create policy "exam_templates_owner"
  on public.exam_templates for all to authenticated
  using (
    exists (select 1 from public.teachers t
            where t.id = exam_templates.teacher_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.teachers t
            where t.id = exam_templates.teacher_id and t.owner_id = auth.uid())
  );

revoke all on public.exam_templates from anon;
grant select, insert, update, delete on public.exam_templates to authenticated;
