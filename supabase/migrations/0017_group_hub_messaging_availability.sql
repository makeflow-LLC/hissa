-- ============================================================
-- لوحة المجموعة، ورسائل موجّهة إلى مجموعة، وحالة توفّر المعلّم
-- ============================================================
--
-- المجموعة كانت مجرّد وسم يُعلَّق على الطالب: تُنشئها وتضع فيها أسماء ثم
-- لا شيء بعد ذلك. هذه الهجرة تجعلها صفّاً دراسياً له صفحته: رابط واتساب،
-- وهدف، وموعد لقاء، وتعميم يصل أعضاءها وحدهم.

-- ------------------------------------------------------------
-- ١) المجموعة تصير صفّاً له بياناته
-- ------------------------------------------------------------
alter table public.student_groups
  add column if not exists whatsapp_link text not null default '',
  add column if not exists goal          text not null default '',
  add column if not exists schedule      text not null default '';

comment on column public.student_groups.whatsapp_link is
  'رابط دعوة مجموعة واتساب — يراه أعضاء المجموعة وحدهم، لا الزوّار.';

-- ------------------------------------------------------------
-- ٢) رسالة موجّهة إلى مجموعة
--
-- عمود واحد بدل جدول ثانٍ: الرسالة تبقى صفّاً في نفس الخيط، ويصير
-- المعنى ثلاثياً — student_id مضبوط = خاصّة، وgroup_id مضبوط = لمجموعة،
-- وكلاهما فارغ = تعميم لكل المتابعين.
-- ------------------------------------------------------------
alter table public.teacher_messages
  add column if not exists group_id uuid
  references public.student_groups (id) on delete cascade;

create index if not exists teacher_messages_group_idx
  on public.teacher_messages (group_id, created_at desc);

drop policy if exists "messages_student_read" on public.teacher_messages;
create policy "messages_student_read"
  on public.teacher_messages for select
  using (
    -- رسالة خاصّة بي
    student_id = auth.uid()
    -- تعميم من معلّم أتابعه
    or (
      student_id is null
      and group_id is null
      and exists (
        select 1 from public.follows f
        where f.teacher_id = teacher_messages.teacher_id
          and f.student_id = auth.uid()
      )
    )
    -- تعميم لمجموعة أنا عضو فيها
    or (
      student_id is null
      and group_id is not null
      and exists (
        select 1 from public.student_group_members m
        where m.group_id = teacher_messages.group_id
          and m.student_id = auth.uid()
      )
    )
  );

-- المعلّم لا يوجّه رسالة إلى مجموعة ليست مجموعته
drop policy if exists "messages_teacher_all" on public.teacher_messages;
create policy "messages_teacher_all"
  on public.teacher_messages for all
  using (
    exists (
      select 1 from public.teachers t
      where t.id = teacher_messages.teacher_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
      where t.id = teacher_messages.teacher_id and t.owner_id = auth.uid()
    )
    and (
      group_id is null
      or exists (
        select 1 from public.student_groups g
        where g.id = teacher_messages.group_id
          and g.teacher_id = teacher_messages.teacher_id
      )
    )
  );

-- ------------------------------------------------------------
-- ٣) الطالب يُخفي رسالة انتهى منها
--
-- الحذف الحقيقي لا يصلح للتعميم: الصفّ واحد يقرؤه عشرون طالباً، فحذف
-- أحدهم يمحوه عن الباقين. لذلك يسجّل الطالب «إخفاءً» يخصّه وحده، أمّا
-- رسالته هو فيحذفها فعلاً (سياسة messages_student_delete_own من 0011).
-- ------------------------------------------------------------
create table if not exists public.message_dismissals (
  message_id uuid not null references public.teacher_messages (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, student_id)
);

alter table public.message_dismissals enable row level security;

drop policy if exists "dismissals_own" on public.message_dismissals;
create policy "dismissals_own"
  on public.message_dismissals for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

revoke all on public.message_dismissals from anon;
grant select, insert, delete on public.message_dismissals to authenticated;

-- ------------------------------------------------------------
-- ٤) حالة توفّر المعلّم
--
-- الطالب يرسل سؤاله ثم ينتظر جواباً لا يعرف متى يأتي. سطر واحد يقول
-- «متاح الآن» أو «أعود مساءً» يوفّر عليه الانتظار الحائر.
-- ------------------------------------------------------------
alter table public.teachers
  add column if not exists availability text not null default 'available'
    check (availability in ('available', 'busy', 'offline')),
  add column if not exists availability_note text not null default '',
  add column if not exists availability_at timestamptz not null default now();

comment on column public.teachers.availability is
  'available = متاح للردّ · busy = مشغول الآن · offline = خارج الخدمة';
