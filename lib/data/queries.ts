import { createClient } from "@/lib/supabase/server";
import { normalizeSubject } from "@/lib/arabic";
import type { ExamTemplate } from "@/lib/examTemplates";
import type {
  FollowStatus,
  JoinRequest,
  MyTeacher,
  AttachmentRow,
  LessonContent,
  LessonMeta,
  LessonPage,
  QuizQuestionRow,
  ParentReport,
  StudentProfile,
  TeacherCard,
  TeacherMessage,
  AttemptForGrading,
  CardRequest,
  GroupHub,
  GroupMember,
  Exam,
  ExamAnswer,
  ExamPaperQuestion,
  ExamQuestion,
  ExamSummary,
  MyCardRequest,
  StudentExam,
  ReportCard,
  StudentGroup,
  TeacherProfile,
  TeacherRow,
  TeacherStudent,
  UnitWithLessons,
} from "@/lib/data/types";

/** الأعمدة الوصفية للدرس — الوحيدة المتاحة للزائر (انظر 0004_visitor_column_gating.sql) */
const LESSON_META_COLS =
  "id, unit_id, title, description, duration, emoji, gradient, position, is_free_preview";

const TEACHER_COLS =
  "id, slug, name, subject, stages, bio, initials, gradient, avatar_url, whatsapp, rating, rating_count, qualification, experience_years, join_instructions, availability, availability_note";

/**
 * المستخدم الحالي (null للزائر).
 * يفشل «مغلقاً»: أي خطأ في الاتصال أو الإعداد يعامَل كزائر، فلا يتسرّب
 * محتوى ولا ينهار الشريط العلوي الموجود في التخطيط الجذري.
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** اسم الطالب المعروض، من جدول profiles ثم من بيانات الحساب */
export async function getStudentName(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    return (
      data?.full_name?.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "طالب"
    );
  } catch {
    return null;
  }
}

/** دليل المعلمين: كل معلم مع عدد دروسه ووحداته وطلابه */
export async function getTeacherCards(): Promise<TeacherCard[]> {
  const supabase = await createClient();

  const [teachersRes, lessonsRes, followsRes, unitsRes] = await Promise.all([
    supabase
      .from("teachers")
      .select(TEACHER_COLS)
      .eq("is_published", true)
      .order("created_at"),
    supabase.from("lessons").select("id, teacher_id, title").eq("status", "published"),
    supabase.from("follows").select("teacher_id"),
    supabase.from("units").select("id, teacher_id"),
  ]);

  if (teachersRes.error) throw teachersRes.error;

  const lessonCounts = new Map<string, number>();
  // عناوين الدروس تدخل نص البحث ليجد الطالب المعلّم بموضوع درسه
  const lessonTitles = new Map<string, string[]>();
  for (const l of lessonsRes.data ?? []) {
    lessonCounts.set(l.teacher_id, (lessonCounts.get(l.teacher_id) ?? 0) + 1);
    const list = lessonTitles.get(l.teacher_id) ?? [];
    list.push(String(l.title ?? ""));
    lessonTitles.set(l.teacher_id, list);
  }
  const studentCounts = new Map<string, number>();
  for (const f of followsRes.data ?? []) {
    studentCounts.set(f.teacher_id, (studentCounts.get(f.teacher_id) ?? 0) + 1);
  }
  const unitCounts = new Map<string, number>();
  for (const u of unitsRes.data ?? []) {
    unitCounts.set(u.teacher_id, (unitCounts.get(u.teacher_id) ?? 0) + 1);
  }

  return (teachersRes.data as TeacherRow[]).map((t) => ({
    ...t,
    lessonCount: lessonCounts.get(t.id) ?? 0,
    studentCount: studentCounts.get(t.id) ?? 0,
    unitCount: unitCounts.get(t.id) ?? 0,
    searchText: [
      t.name,
      t.subject,
      t.bio,
      t.qualification,
      ...t.stages,
      ...(lessonTitles.get(t.id) ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

/** بروفايل معلم: منهجه + حالة الطالب الحالي تجاهه */
export async function getTeacherProfile(
  slug: string
): Promise<TeacherProfile | null> {
  const supabase = await createClient();

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select(TEACHER_COLS)
    .eq("slug", slug)
    .maybeSingle();
  // فشل الاتصال ≠ معلم غير موجود: نرمي الخطأ فتعرض الصفحة ConnectionNotice
  if (error) throw error;
  if (!teacher) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [unitsRes, lessonsRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, title, description, position")
      .eq("teacher_id", teacher.id)
      .order("position"),
    supabase
      .from("lessons")
      .select(LESSON_META_COLS)
      .eq("teacher_id", teacher.id)
      .eq("status", "published")
      .order("position"),
  ]);

  const lessons = (lessonsRes.data ?? []) as LessonMeta[];
  const units: UnitWithLessons[] = (unitsRes.data ?? []).map((u) => ({
    ...u,
    lessons: lessons.filter((l) => l.unit_id === u.id),
  }));

  // حالة الطالب: طلب الانضمام، دروس منجزة، وتقييمه إن كتبه
  let followStatus: FollowStatus = "none";
  let followDecisionNote = "";
  let subjectClashTeacher = "";
  let inTeacherGroup = false;
  let completedLessonIds: string[] = [];
  let myReview: { rating: number; comment: string } | null = null;

  if (user) {
    const lessonIds = lessons.map((l) => l.id);

    const [followRes, progressRes, reviewRes] = await Promise.all([
      supabase
        .from("follows")
        .select("teacher_id, status, decision_note")
        .eq("student_id", user.id)
        .eq("teacher_id", teacher.id)
        .maybeSingle(),
      lessonIds.length
        ? supabase
            .from("lesson_progress")
            .select("lesson_id")
            .eq("student_id", user.id)
            .in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] as { lesson_id: string }[] }),
      supabase
        .from("reviews")
        .select("rating, comment")
        .eq("student_id", user.id)
        .eq("teacher_id", teacher.id)
        .maybeSingle(),
    ]);

    const followRow = followRes.data as
      | { status?: string; decision_note?: string }
      | null;
    followStatus = (followRow?.status as FollowStatus) ?? "none";
    followDecisionNote = String(followRow?.decision_note ?? "");
    completedLessonIds = (progressRes.data ?? []).map((p) => p.lesson_id);
    myReview = (reviewRes.data as { rating: number; comment: string } | null) ?? null;

    /**
     * عضوية مجموعة عند هذا المعلّم — وهي شرط رؤية رقم واتسابه.
     * سياستا `groups_student_read` و `group_members_student_read` تقصران
     * ما يقرأه الطالب على مجموعاته هو، فالاستعلام آمن بذاته.
     */
    if (followStatus === "approved") {
      const { data: myGroups } = await supabase
        .from("student_group_members")
        .select("group_id, student_groups!inner(teacher_id)")
        .eq("student_id", user.id);
      inTeacherGroup = ((myGroups ?? []) as unknown as {
        student_groups: { teacher_id: string } | { teacher_id: string }[] | null;
      }[]).some((m) => {
        const g = Array.isArray(m.student_groups) ? m.student_groups[0] : m.student_groups;
        return g?.teacher_id === teacher.id;
      });
    }

    /**
     * معلّم واحد لكل مادة: نكشف التعارض هنا لنشرحه للطالب قبل أن يضغط،
     * بدل أن يصطدم برفض قاعدة البيانات. الفرض نفسه هناك لا هنا.
     */
    if (followStatus !== "pending" && followStatus !== "approved") {
      const { data: mine } = await supabase
        .from("follows")
        .select("teacher_id, status")
        .eq("student_id", user.id)
        .in("status", ["pending", "approved"]);
      const otherIds = (mine ?? [])
        .map((f) => f.teacher_id as string)
        .filter((id) => id !== teacher.id);
      if (otherIds.length) {
        const { data: others } = await supabase
          .from("teachers")
          .select("name, subject")
          .in("id", otherIds);
        const mySubject = normalizeSubject(String(teacher.subject ?? ""));
        const clash = (others ?? []).find(
          (o) => normalizeSubject(String(o.subject ?? "")) === mySubject
        );
        if (clash) subjectClashTeacher = String(clash.name);
      }
    }
  }

  // آخر التقييمات المكتوبة لعرضها في الصفحة العامة
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, student_id")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const reviewerIds = (reviewRows ?? []).map((r) => r.student_id as string);
  const namesById = new Map<string, string>();
  if (reviewerIds.length) {
    const { data: names } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", reviewerIds);
    for (const n of names ?? []) namesById.set(n.id, n.full_name);
  }

  return {
    teacher: teacher as TeacherRow,
    units,
    followStatus,
    followDecisionNote,
    subjectClashTeacher,
    inTeacherGroup,
    isFollowing: followStatus !== "none",
    completedLessonIds,
    myReview,
    reviews: (reviewRows ?? []).map((r) => ({
      id: String(r.id),
      rating: Number(r.rating),
      comment: String(r.comment ?? ""),
      created_at: String(r.created_at),
      studentName: namesById.get(r.student_id as string) ?? "طالب",
    })),
  };
}

/** صفحة درس واحد: المحتوى مقفل على الزائر إلا في العيّنة المجانية */
export async function getLessonPage(
  slug: string,
  lessonId: string
): Promise<LessonPage | null> {
  const supabase = await createClient();

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select(TEACHER_COLS)
    .eq("slug", slug)
    .maybeSingle();
  // فشل الاتصال ≠ معلم غير موجود
  if (error) throw error;
  if (!teacher) return null;

  // كل دروس المعلم بترتيب المنهج (وحدة ثم موضع) لحساب السابق/التالي
  const [{ data: unitRows }, { data: lessonRows }] = await Promise.all([
    supabase
      .from("units")
      .select("id, title, position")
      .eq("teacher_id", teacher.id)
      .order("position"),
    supabase
      .from("lessons")
      .select(LESSON_META_COLS)
      .eq("teacher_id", teacher.id)
      .eq("status", "published")
      .order("position"),
  ]);

  const units = unitRows ?? [];
  const allLessons = (lessonRows ?? []) as LessonMeta[];
  const ordered = units.flatMap((u) =>
    allLessons.filter((l) => l.unit_id === u.id)
  );

  const index = ordered.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;
  const lesson = ordered[index];
  const unit = units.find((u) => u.id === lesson.unit_id) ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // القفل: زائر + درس ليس عيّنة مجانية
  const locked = !user && !lesson.is_free_preview;

  let content: LessonContent | null = null;
  let attachments: AttachmentRow[] = [];
  let quiz: QuizQuestionRow[] = [];
  let isCompleted = false;
  let quizAttempt: { score: number; total: number } | null = null;

  if (!locked) {
    if (user) {
      // المسجّل يقرأ الأعمدة الكاملة مباشرة (صلاحيات authenticated)
      const [contentRes, attRes, quizRes, progressRes, attemptRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("sections, gallery, video_url")
          .eq("id", lesson.id)
          .maybeSingle(),
        supabase
          .from("lesson_attachments")
          .select("id, name, kind, size, file_path")
          .eq("lesson_id", lesson.id)
          .order("position"),
        supabase
          .from("quiz_questions")
          .select("id, prompt, options, correct_index")
          .eq("lesson_id", lesson.id)
          .order("position"),
        supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", user.id)
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
        supabase
          .from("quiz_attempts")
          .select("score, total")
          .eq("student_id", user.id)
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
      ]);
      content = (contentRes.data as LessonContent) ?? null;
      attachments = (attRes.data ?? []) as AttachmentRow[];
      quiz = (quizRes.data ?? []) as QuizQuestionRow[];
      isCompleted = Boolean(progressRes.data);
      quizAttempt =
        (attemptRes.data as { score: number; total: number } | null) ?? null;
    } else {
      // الزائر في العيّنة المجانية: الدالة الآمنة هي طريقه الوحيد للمحتوى
      const { data } = await supabase.rpc("get_free_preview_content", {
        p_lesson_id: lesson.id,
      });
      const row = Array.isArray(data) ? data[0] : data;
      content = (row as LessonContent) ?? null;
    }
  }

  return {
    teacher: teacher as TeacherRow,
    unit: unit ? { id: unit.id, title: unit.title } : null,
    lesson,
    content,
    attachments,
    quiz,
    unitLessons: allLessons.filter((l) => l.unit_id === lesson.unit_id),
    index,
    total: ordered.length,
    prev: index > 0 ? { id: ordered[index - 1].id, title: ordered[index - 1].title } : null,
    next:
      index < ordered.length - 1
        ? { id: ordered[index + 1].id, title: ordered[index + 1].title }
        : null,
    isCompleted,
    locked,
    quizAttempt,
  };
}

/* ===================== لوحة الطالب ===================== */

export interface DashboardTeacherProgress {
  teacher: Pick<TeacherRow, "id" | "slug" | "name" | "subject" | "initials" | "gradient" | "avatar_url">;
  units: { id: string; title: string; total: number; done: number }[];
  total: number;
  done: number;
  /** أول درس غير منجز — زر «أكمل التعلّم» */
  nextLesson: { id: string; title: string } | null;
}

export interface StudentDashboard {
  following: DashboardTeacherProgress[];
}

/** بيانات لوحة الطالب: معلّميّ + تقدّمي */
export async function getStudentDashboard(): Promise<StudentDashboard | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [followRes, progressRes] = await Promise.all([
    supabase
      .from("follows")
      .select(
        `teacher_id,
         teachers!inner ( id, slug, name, subject, initials, gradient, avatar_url )`
      )
      .eq("student_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase.from("lesson_progress").select("lesson_id").eq("student_id", user.id),
  ]);

  // Supabase تستنتج العلاقات المضمّنة كمصفوفات أحياناً وكعنصر أحياناً،
  // فنطبّع الشكل قبل الاستخدام
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const doneIds = new Set((progressRes.data ?? []).map((p) => p.lesson_id));

  type TeacherLite = DashboardTeacherProgress["teacher"];
  type FollowJoin = {
    teacher_id: string;
    teachers: TeacherLite | TeacherLite[] | null;
  };
  const followed = ((followRes.data ?? []) as unknown as FollowJoin[])
    .map((f) => one(f.teachers))
    .filter((t): t is TeacherLite => Boolean(t));

  const following: DashboardTeacherProgress[] = [];
  for (const t of followed) {
    const [{ data: unitRows }, { data: lessonRows }] = await Promise.all([
      supabase
        .from("units")
        .select("id, title, position")
        .eq("teacher_id", t.id)
        .order("position"),
      supabase
        .from("lessons")
        .select("id, unit_id, title, position")
        .eq("teacher_id", t.id)
        .eq("status", "published")
        .order("position"),
    ]);

    const units = unitRows ?? [];
    const lessons = lessonRows ?? [];
    const ordered = units.flatMap((u) => lessons.filter((l) => l.unit_id === u.id));
    const nextUndone = ordered.find((l) => !doneIds.has(l.id)) ?? null;

    following.push({
      teacher: t,
      units: units.map((u) => {
        const unitLessons = lessons.filter((l) => l.unit_id === u.id);
        return {
          id: u.id,
          title: u.title,
          total: unitLessons.length,
          done: unitLessons.filter((l) => doneIds.has(l.id)).length,
        };
      }),
      total: ordered.length,
      done: ordered.filter((l) => doneIds.has(l.id)).length,
      nextLesson: nextUndone ? { id: nextUndone.id, title: nextUndone.title } : null,
    });
  }

  return { following };
}

/* ===================== حساب المعلّم ===================== */

/** ملف المعلّم المملوك للمستخدم الحالي (null إن لم يكن معلّماً بعد) */
export async function getMyTeacher(): Promise<MyTeacher | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("teachers")
    .select(`${TEACHER_COLS}, is_published`)
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as MyTeacher) ?? null;
}

/**
 * دور الحساب الحالي — مصدر واحد للحقيقة يمنع ازدواج الهوية.
 *
 * القاعدة: البريد الواحد إمّا معلّم وإمّا طالب، لا الاثنين معاً.
 * - «معلّم» = يملك صفاً في teachers.
 * - «طالب نشِط» = يتابع معلّماً أو له تقدّم محفوظ؛ لا يجوز أن يفتح
 *   حساب معلّم على البريد نفسه.
 * - «حساب جديد» = سجّل دخوله ولم يفعل شيئاً بعد؛ يجوز أن يصبح معلّماً
 *   (هذا هو مسار تسجيل المعلّم الطبيعي: دخول ثم إنشاء بروفايل).
 *
 * يفشل «مغلقاً» لأنه يُستدعى من الشريط العلوي في التخطيط الجذري.
 */
export type AccountRole = "visitor" | "new" | "student" | "teacher";

export async function getAccountRole(): Promise<AccountRole> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "visitor";

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (teacher) return "teacher";

    const [fol, prog] = await Promise.all([
      supabase
        .from("follows")
        .select("teacher_id", { count: "exact", head: true })
        .eq("student_id", user.id),
      supabase
        .from("lesson_progress")
        .select("lesson_id", { count: "exact", head: true })
        .eq("student_id", user.id),
    ]);

    const active = (fol.count ?? 0) + (prog.count ?? 0);
    return active > 0 ? "student" : "new";
  } catch {
    return "visitor";
  }
}

/** هل المستخدم الحالي معلّم مسجّل؟ (لعناصر التنقل) */
export async function isCurrentUserTeacher(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("teachers")
      .select("slug")
      .eq("owner_id", user.id)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/* ============== محتوى المعلّم (لإدارته من حسابه) ============== */

export interface TeacherUnit {
  id: string;
  title: string;
  description: string;
  position: number;
  lessons: {
    id: string;
    title: string;
    description: string;
    duration: string;
    emoji: string;
    status: string;
    is_free_preview: boolean;
    is_restricted: boolean;
    position: number;
  }[];
}

export interface TeacherContent {
  teacherId: string;
  slug: string;
  units: TeacherUnit[];
}

/** كل محتوى المعلّم الحالي (بما فيه المسودات) لإدارته */
export async function getMyTeacherContent(): Promise<TeacherContent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return null;

  const [unitsRes, lessonsRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, title, description, position")
      .eq("teacher_id", teacher.id)
      .order("position"),
    supabase
      .from("lessons")
      .select("id, unit_id, title, description, duration, emoji, status, is_free_preview, is_restricted, position")
      .eq("teacher_id", teacher.id)
      .order("position"),
  ]);

  type L = TeacherUnit["lessons"][number] & { unit_id: string | null };
  const lessons = (lessonsRes.data ?? []) as L[];
  const units: TeacherUnit[] = (unitsRes.data ?? []).map((u) => ({
    ...u,
    lessons: lessons.filter((l) => l.unit_id === u.id),
  }));

  return {
    teacherId: teacher.id,
    slug: teacher.slug,
    units,
  };
}

/** درس واحد يملكه المعلّم الحالي (للتعديل) */
export async function getMyLesson(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("lessons")
    .select(
      "id, unit_id, title, description, duration, emoji, video_url, sections, is_free_preview, is_restricted, status, teachers!inner(owner_id)"
    )
    .eq("id", lessonId)
    .maybeSingle();
  const row = data as
    | (Record<string, unknown> & { teachers: { owner_id: string } | { owner_id: string }[] })
    | null;
  if (!row) return null;
  const owner = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
  if (owner?.owner_id !== user.id) return null;
  return row;
}

/** درس يملكه المعلّم بالشكل الجاهز لنموذج التعديل (مع الأقسام والأسئلة) */
export async function getMyLessonForEdit(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("lessons")
    .select(
      "id, unit_id, title, description, duration, emoji, video_url, sections, is_free_preview, is_restricted, status, teachers!inner(owner_id)"
    )
    .eq("id", lessonId)
    .maybeSingle();
  const row = data as
    | (Record<string, unknown> & {
        teachers: { owner_id: string } | { owner_id: string }[];
      })
    | null;
  if (!row) return null;
  const owner = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
  if (owner?.owner_id !== user.id) return null;

  const [{ data: quizRows }, { data: attachRows }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("prompt, options, correct_index")
      .eq("lesson_id", lessonId)
      .order("position"),
    supabase
      .from("lesson_attachments")
      .select("id, name, kind, size, file_path")
      .eq("lesson_id", lessonId)
      .order("position"),
  ]);

  const rawSections = Array.isArray(row.sections) ? row.sections : [];
  const sections = rawSections.map((s) => {
    const o = s as Record<string, unknown>;
    return {
      heading: String(o.heading ?? ""),
      /**
       * الشرح المنسّق يُخزَّن في `html`. إغفاله هنا كان يفتح المحرّر فارغاً
       * دائماً مهما كان المحفوظ، فيظنّ المعلّم أن شيئاً لم يُحفَظ — وإن حفظ
       * مرّة أخرى كتب الفراغ فوق شرحه. `paragraphs` هو الشكل القديم فقط.
       */
      html: typeof o.html === "string" ? o.html : undefined,
      paragraphs: Array.isArray(o.paragraphs)
        ? (o.paragraphs as unknown[]).map((p) => String(p))
        : [],
    };
  });

  return {
    id: String(row.id),
    unit_id: (row.unit_id as string | null) ?? null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    duration: String(row.duration ?? ""),
    emoji: String(row.emoji ?? "📚"),
    video_url: (row.video_url as string | null) ?? null,
    status: String(row.status ?? "published"),
    is_free_preview: Boolean(row.is_free_preview),
    is_restricted: Boolean(row.is_restricted),
    sections,
    quiz: (quizRows ?? []).map((q) => ({
      prompt: String(q.prompt ?? ""),
      options: Array.isArray(q.options)
        ? (q.options as unknown[]).map((x) => String(x))
        : [],
      correct_index: Number(q.correct_index ?? 0),
    })),
    attachments: (attachRows ?? []) as AttachmentRow[],
  };
}

/* ============== بيانات الطالب ورسائل المعلّم والمنح ============== */

const STUDENT_PROFILE_COLS =
  "id, full_name, avatar_url, grade, school, city, age, phone, whatsapp, guardian_phone, profile_done";

/** ملف الطالب الحالي (null للزائر أو عند فشل الاتصال) */
export async function getMyStudentProfile(): Promise<StudentProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select(STUDENT_PROFILE_COLS)
      .eq("id", user.id)
      .maybeSingle();
    return (data as StudentProfile) ?? null;
  } catch {
    return null;
  }
}

/** الرسائل الواردة للطالب الحالي مع اسم المعلّم المرسِل */
export async function getMyMessages(): Promise<
  (TeacherMessage & {
    teacherName: string;
    teacherSlug: string;
    groupName: string;
  })[]
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const [{ data }, { data: hidden }] = await Promise.all([
      supabase
        .from("teacher_messages")
        .select(
          "id, teacher_id, student_id, group_id, body, created_at, sender, teachers(name, slug), student_groups(name)"
        )
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("message_dismissals")
        .select("message_id")
        .eq("student_id", user.id),
    ]);

    /**
     * ما أخفاه الطالب يُرشَّح هنا لا في قاعدة البيانات: صفّ التعميم واحد
     * يقرؤه كل أعضاء المجموعة، فحذفه فعلياً يمحوه عن الجميع.
     */
    const dismissed = new Set(
      ((hidden ?? []) as { message_id: string }[]).map((d) => d.message_id)
    );

    return (data ?? [])
      .filter((m) => !dismissed.has(String((m as { id: string }).id)))
      .slice(0, 30)
      .map((m) => {
        const row = m as Record<string, unknown> & {
          teachers: { name: string; slug: string } | { name: string; slug: string }[];
          student_groups: { name: string } | { name: string }[] | null;
        };
        const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
        const g = Array.isArray(row.student_groups)
          ? row.student_groups[0]
          : row.student_groups;
        return {
          id: String(row.id),
          teacher_id: String(row.teacher_id),
          student_id: (row.student_id as string | null) ?? null,
          group_id: (row.group_id as string | null) ?? null,
          body: String(row.body ?? ""),
          created_at: String(row.created_at),
          sender: row.sender === "student" ? ("student" as const) : ("teacher" as const),
          teacherName: t?.name ?? "معلّم",
          teacherSlug: t?.slug ?? "",
          groupName: g?.name ?? "",
        };
      });
  } catch {
    return [];
  }
}

/**
 * طلاب المعلّم الحالي (من يتابعونه) مع تقدّمهم في منهجه ومنحهم.
 * سياسات 0008 تسمح للمعلّم بقراءة ملفات متابعيه وتقدّمهم في دروسه هو فقط.
 */
export async function getMyStudents(): Promise<TeacherStudent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  // المقبولون فقط — الطلب المعلّق ليس طالباً بعد
  const { data: follows } = await supabase
    .from("follows")
    .select("student_id, created_at")
    .eq("teacher_id", teacher.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const followRows = (follows ?? []) as { student_id: string; created_at: string }[];
  if (followRows.length === 0) return [];

  const studentIds = followRows.map((f) => f.student_id);

  const [profilesRes, lessonsRes, grantsRes, groupsRes] = await Promise.all([
    supabase.from("profiles").select(STUDENT_PROFILE_COLS).in("id", studentIds),
    supabase
      .from("lessons")
      .select("id")
      .eq("teacher_id", teacher.id)
      .eq("status", "published"),
    supabase
      .from("student_grants")
      .select("id, student_id, lesson_id, session_id")
      .eq("teacher_id", teacher.id),
    supabase
      .from("student_groups")
      .select("id, student_group_members(student_id)")
      .eq("teacher_id", teacher.id),
  ]);

  // مجموعات كل طالب عند هذا المعلّم
  const groupsByStudent = new Map<string, string[]>();
  for (const g of (groupsRes.data ?? []) as {
    id: string;
    student_group_members: { student_id: string }[] | null;
  }[]) {
    for (const m of g.student_group_members ?? []) {
      const list = groupsByStudent.get(m.student_id) ?? [];
      list.push(g.id);
      groupsByStudent.set(m.student_id, list);
    }
  }

  const myLessonIds = (lessonsRes.data ?? []).map((l) => l.id as string);
  const totalLessons = myLessonIds.length;

  // تقدّم متابعيه في دروسه فقط
  let progress: { student_id: string; lesson_id: string }[] = [];
  if (totalLessons > 0) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("student_id, lesson_id")
      .in("lesson_id", myLessonIds)
      .in("student_id", studentIds);
    progress = (data ?? []) as { student_id: string; lesson_id: string }[];
  }

  const profileById = new Map(
    ((profilesRes.data ?? []) as StudentProfile[]).map((p) => [p.id, p])
  );

  return followRows.map((f) => {
    const done = progress.filter((p) => p.student_id === f.student_id).length;
    const profile =
      profileById.get(f.student_id) ??
      ({
        id: f.student_id,
        full_name: "طالب",
        avatar_url: null,
        grade: "",
        school: "",
        city: "",
        age: null,
        phone: null,
        whatsapp: null,
        guardian_phone: null,
        profile_done: false,
      } as StudentProfile);

    return {
      profile,
      followedAt: f.created_at,
      completedLessons: done,
      totalLessons,
      progressPct: totalLessons ? Math.round((done / totalLessons) * 100) : 0,
      grants: ((grantsRes.data ?? []) as {
        id: string;
        student_id: string;
        lesson_id: string | null;
        session_id: string | null;
      }[])
        .filter((g) => g.student_id === f.student_id)
        .map((g) => ({ id: g.id, lesson_id: g.lesson_id, session_id: g.session_id })),
      groupIds: groupsByStudent.get(f.student_id) ?? [],
    };
  });
}

/** طلبات الانضمام المعلّقة عند المعلّم الحالي */
export async function getJoinRequests(): Promise<JoinRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data: rows } = await supabase
    .from("follows")
    .select("student_id, requested_at")
    .eq("teacher_id", teacher.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  const reqs = (rows ?? []) as {
    student_id: string;
    requested_at: string;
  }[];
  if (reqs.length === 0) return [];

  /**
   * المعلّم يقرأ ملف مقدّم الطلب ليقرّر عن بيّنة (سياسة 0013): الطالب هو
   * من بادر إليه بالذات. الطلب نفسه لا يحمل رسالة — الاتجاه معاكس، فالمعلّم
   * هو من يكتب شروطه مسبقاً والطالب يوافق عليها.
   */
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, grade, school, city, avatar_url")
    .in(
      "id",
      reqs.map((r) => r.student_id)
    );
  const byId = new Map(
    ((profiles ?? []) as Record<string, string | null>[]).map((p) => [
      String(p.id),
      p,
    ])
  );

  return reqs.map((r) => {
    const p = byId.get(r.student_id);
    return {
      studentId: r.student_id,
      name: String(p?.full_name ?? "طالب جديد"),
      grade: String(p?.grade ?? ""),
      school: String(p?.school ?? ""),
      city: String(p?.city ?? ""),
      avatarUrl: (p?.avatar_url as string | null) ?? null,
      requestedAt: r.requested_at,
    };
  });
}

/** مجموعات المعلّم الحالي مع عدد أعضاء كل مجموعة */
export async function getMyGroups(): Promise<StudentGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("student_groups")
    .select(
      "id, name, description, position, whatsapp_link, goal, schedule, student_group_members(student_id)"
    )
    .eq("teacher_id", teacher.id)
    .order("position");

  return ((data ?? []) as (GroupRow & {
    student_group_members: { student_id: string }[] | null;
  })[]).map((g) => ({
    ...toGroup(g),
    memberCount: (g.student_group_members ?? []).length,
  }));
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  position: number | null;
  whatsapp_link: string | null;
  goal: string | null;
  schedule: string | null;
}

function toGroup(g: GroupRow): StudentGroup {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? "",
    position: g.position ?? 0,
    memberCount: 0,
    whatsapp_link: g.whatsapp_link ?? "",
    goal: g.goal ?? "",
    schedule: g.schedule ?? "",
  };
}

/** بطاقات التقييم التي أصدرها المعلّم الحالي */
export async function getIssuedReportCards(): Promise<ReportCard[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("report_cards")
    .select("*")
    .eq("teacher_id", teacher.id)
    .order("issued_at", { ascending: false });

  return (data ?? []) as ReportCard[];
}

/** طلبات الانضمام التي أرسلها الطالب الحالي ولم تُقبل بعد */
export async function getMyPendingJoins(): Promise<
  { teacherName: string; teacherSlug: string; status: "pending" | "rejected"; note: string }[]
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("follows")
      .select("status, decision_note, teachers(name, slug)")
      .eq("student_id", user.id)
      .in("status", ["pending", "rejected"])
      .order("requested_at", { ascending: false });

    return ((data ?? []) as {
      status: string;
      decision_note: string;
      teachers: { name: string; slug: string } | { name: string; slug: string }[] | null;
    }[]).map((r) => {
      const t = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
      return {
        teacherName: t?.name ?? "معلّم",
        teacherSlug: t?.slug ?? "",
        status: r.status === "rejected" ? ("rejected" as const) : ("pending" as const),
        note: String(r.decision_note ?? ""),
      };
    });
  } catch {
    return [];
  }
}

/** طلبات بطاقات التقييم المعلّقة عند المعلّم الحالي */
export async function getCardRequests(): Promise<CardRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("report_card_requests")
    .select("id, student_id, created_at")
    .eq("teacher_id", teacher.id)
    .eq("status", "pending")
    .order("created_at");

  const rows = (data ?? []) as {
    id: string;
    student_id: string;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in(
      "id",
      rows.map((r) => r.student_id)
    );
  const names = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ])
  );

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: names.get(r.student_id) ?? "طالب",
    createdAt: r.created_at,
  }));
}

/** طلبات بطاقات التقييم التي أرسلها الطالب الحالي */
export async function getMyCardRequests(): Promise<MyCardRequest[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("report_card_requests")
      .select("id, status, created_at, teachers(name)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    return ((data ?? []) as {
      id: string;
      status: string;
      created_at: string;
      teachers: { name: string } | { name: string }[] | null;
    }[]).map((r) => {
      const t = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
      return {
        id: r.id,
        teacherName: t?.name ?? "معلّم",
        status: (r.status as MyCardRequest["status"]) ?? "pending",
        createdAt: r.created_at,
      };
    });
  } catch {
    return [];
  }
}

/** بطاقات تقييم الطالب الحالي (يراها على لوحته) */
export async function getMyReportCards(): Promise<
  (ReportCard & { teacherName: string; unitTitle: string })[]
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("report_cards")
      .select("*, teachers(name), units(title)")
      .eq("student_id", user.id)
      .order("issued_at", { ascending: false });

    return ((data ?? []) as (ReportCard & {
      teachers: { name: string } | { name: string }[] | null;
      units: { title: string } | { title: string }[] | null;
    })[]).map((r) => {
      const t = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
      const u = Array.isArray(r.units) ? r.units[0] : r.units;
      return { ...r, teacherName: t?.name ?? "معلّم", unitTitle: u?.title ?? "" };
    });
  } catch {
    return [];
  }
}

/** تقارير المعلّمين عن الطالب الحالي (يراها الطالب على لوحته) */
export async function getMyParentReports(): Promise<
  (ParentReport & { teacherName: string })[]
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("parent_reports")
      .select(
        "id, student_id, period, performance, strengths, improvements, note, created_at, teachers(name)"
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown> & {
        teachers: { name: string } | { name: string }[];
      };
      const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
      return {
        id: String(row.id),
        student_id: String(row.student_id),
        period: String(row.period ?? ""),
        performance: String(row.performance ?? ""),
        strengths: String(row.strengths ?? ""),
        improvements: String(row.improvements ?? ""),
        note: String(row.note ?? ""),
        created_at: String(row.created_at),
        teacherName: t?.name ?? "معلّم",
      };
    });
  } catch {
    return [];
  }
}

/** نتائج اختبارات دروس المعلّم الحالي، مجمّعة لكل درس */
export interface LessonQuizStats {
  lessonId: string;
  lessonTitle: string;
  attempts: number;
  avgPct: number;
  rows: { studentName: string; score: number; total: number; created_at: string }[];
}

export async function getMyQuizStats(): Promise<LessonQuizStats[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title")
    .eq("teacher_id", teacher.id);
  const lessonRows = (lessons ?? []) as { id: string; title: string }[];
  if (lessonRows.length === 0) return [];

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("lesson_id, student_id, score, total, created_at")
    .in(
      "lesson_id",
      lessonRows.map((l) => l.id)
    )
    .order("created_at", { ascending: false });
  const attemptRows = (attempts ?? []) as {
    lesson_id: string;
    student_id: string;
    score: number;
    total: number;
    created_at: string;
  }[];
  if (attemptRows.length === 0) return [];

  const { data: names } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(attemptRows.map((a) => a.student_id))]);
  const nameById = new Map((names ?? []).map((n) => [n.id, n.full_name as string]));

  return lessonRows
    .map((l) => {
      const rows = attemptRows.filter((a) => a.lesson_id === l.id);
      const avgPct = rows.length
        ? Math.round(
            (rows.reduce((n, a) => n + (a.total ? a.score / a.total : 0), 0) /
              rows.length) *
              100
          )
        : 0;
      return {
        lessonId: l.id,
        lessonTitle: l.title,
        attempts: rows.length,
        avgPct,
        rows: rows.map((a) => ({
          studentName: nameById.get(a.student_id) ?? "طالب",
          score: a.score,
          total: a.total,
          created_at: a.created_at,
        })),
      };
    })
    .filter((s) => s.attempts > 0);
}

/** خيوط محادثة المعلّم مع كل طالب (أسئلة الطلاب وردوده) */
export interface StudentThread {
  studentId: string;
  studentName: string;
  messages: { id: string; body: string; created_at: string; sender: string }[];
  unansweredCount: number;
}

export async function getMyThreads(): Promise<StudentThread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("teacher_messages")
    .select("id, student_id, body, created_at, sender")
    .eq("teacher_id", teacher.id)
    .not("student_id", "is", null)
    .order("created_at");

  const rows = (data ?? []) as {
    id: string;
    student_id: string;
    body: string;
    created_at: string;
    sender: string;
  }[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.student_id))];
  const { data: names } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  const nameById = new Map((names ?? []).map((n) => [n.id, n.full_name as string]));

  return ids
    .map((sid) => {
      const messages = rows.filter((r) => r.student_id === sid);
      const last = messages[messages.length - 1];
      return {
        studentId: sid,
        studentName: nameById.get(sid) ?? "طالب",
        messages: messages.map((m) => ({
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          sender: m.sender,
        })),
        // آخر رسالة من الطالب ⇒ بانتظار ردّ المعلّم
        unansweredCount: last?.sender === "student" ? 1 : 0,
      };
    })
    .sort((a, b) => b.unansweredCount - a.unansweredCount);
}


/* ==================== لوحة المجموعة ==================== */

/**
 * كل ما تعرضه صفحة مجموعة واحدة: أعضاؤها وتقدّمهم وعلاماتهم، وتعاميمها،
 * واختباراتها، ودروسها الخاصة، ومن يمكن ضمّه إليها.
 *
 * استعلام واحد مجمّع بدل استدعاءات متفرّقة من الصفحة: الصفحة `force-dynamic`
 * فكل استدعاء رحلة شبكة إضافية على كل زيارة.
 */
export async function getGroupHub(groupId: string): Promise<GroupHub | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return null;

  // المجموعة مقيّدة بمعلّمها: تمرير معرّف مجموعة غريبة لا يفتح شيئاً
  const { data: groupRow } = await supabase
    .from("student_groups")
    .select("id, name, description, position, whatsapp_link, goal, schedule")
    .eq("id", groupId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!groupRow) return null;

  const [membersRes, followsRes, lessonsRes, msgRes, examRes] = await Promise.all([
    supabase
      .from("student_group_members")
      .select("student_id")
      .eq("group_id", groupId),
    supabase
      .from("follows")
      .select("student_id")
      .eq("teacher_id", teacher.id)
      .eq("status", "approved"),
    supabase
      .from("lessons")
      .select("id, title, is_restricted")
      .eq("teacher_id", teacher.id)
      .eq("status", "published"),
    supabase
      .from("teacher_messages")
      .select("id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("exams")
      .select("id, title, status, exam_attempts(status)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  const memberIds = ((membersRes.data ?? []) as { student_id: string }[]).map(
    (m) => m.student_id
  );
  const approvedIds = new Set(
    ((followsRes.data ?? []) as { student_id: string }[]).map((f) => f.student_id)
  );
  const lessons = (lessonsRes.data ?? []) as {
    id: string;
    title: string;
    is_restricted: boolean;
  }[];
  const publishedIds = lessons.map((l) => l.id);
  const restricted = lessons.filter((l) => l.is_restricted);

  /** كل من انضمّ ولم يدخل هذه المجموعة بعد */
  const candidateIds = [...approvedIds].filter((id) => !memberIds.includes(id));

  const allIds = [...new Set([...memberIds, ...candidateIds])];
  const [profilesRes, progressRes, cardsRes, threadRes, attemptRes, grantRes] =
    await Promise.all([
      allIds.length
        ? supabase.from("profiles").select("id, full_name, grade, avatar_url").in("id", allIds)
        : Promise.resolve({ data: [] }),
      memberIds.length && publishedIds.length
        ? supabase
            .from("lesson_progress")
            .select("student_id")
            .in("student_id", memberIds)
            .in("lesson_id", publishedIds)
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? supabase
            .from("report_cards")
            .select("student_id, title, issued_at")
            .eq("teacher_id", teacher.id)
            .in("student_id", memberIds)
            .order("issued_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? supabase
            .from("teacher_messages")
            .select("student_id, sender, created_at")
            .eq("teacher_id", teacher.id)
            .in("student_id", memberIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? supabase
            .from("exam_attempts")
            .select("student_id, auto_score, manual_score, max_score, exam_id, status")
            .in("student_id", memberIds)
        : Promise.resolve({ data: [] }),
      restricted.length
        ? supabase
            .from("student_grants")
            .select("student_id, lesson_id")
            .eq("teacher_id", teacher.id)
        : Promise.resolve({ data: [] }),
    ]);

  const profiles = new Map(
    ((profilesRes.data ?? []) as {
      id: string;
      full_name: string;
      grade: string | null;
      avatar_url: string | null;
    }[]).map((p) => [p.id, p])
  );

  const doneCount = new Map<string, number>();
  for (const p of (progressRes.data ?? []) as { student_id: string }[]) {
    doneCount.set(p.student_id, (doneCount.get(p.student_id) ?? 0) + 1);
  }

  const lastCard = new Map<string, string>();
  for (const c of (cardsRes.data ?? []) as { student_id: string; title: string }[]) {
    if (!lastCard.has(c.student_id)) lastCard.set(c.student_id, c.title);
  }

  /** آخر رسالة في كل خيط: إن كانت من الطالب فهي تنتظر ردّاً */
  const lastSender = new Map<string, string>();
  for (const m of (threadRes.data ?? []) as {
    student_id: string | null;
    sender: string;
  }[]) {
    if (m.student_id && !lastSender.has(m.student_id)) {
      lastSender.set(m.student_id, m.sender);
    }
  }

  const groupExamIds = new Set(
    ((examRes.data ?? []) as { id: string }[]).map((e) => e.id)
  );
  const examScores = new Map<string, { pct: number[]; taken: number }>();
  for (const a of (attemptRes.data ?? []) as {
    student_id: string;
    auto_score: number;
    manual_score: number;
    max_score: number;
    exam_id: string;
    status: string;
  }[]) {
    // علامات هذه المجموعة وحدها، ولمحاولة سُلّمت فعلاً
    if (!groupExamIds.has(a.exam_id) || a.status === "in_progress") continue;
    const entry = examScores.get(a.student_id) ?? { pct: [], taken: 0 };
    if (Number(a.max_score) > 0) {
      entry.pct.push(
        ((Number(a.auto_score) + Number(a.manual_score)) / Number(a.max_score)) * 100
      );
    }
    entry.taken += 1;
    examScores.set(a.student_id, entry);
  }

  const grantedPerLesson = new Map<string, Set<string>>();
  for (const g of (grantRes.data ?? []) as {
    student_id: string;
    lesson_id: string | null;
  }[]) {
    if (!g.lesson_id) continue;
    const set = grantedPerLesson.get(g.lesson_id) ?? new Set<string>();
    set.add(g.student_id);
    grantedPerLesson.set(g.lesson_id, set);
  }

  const totalLessons = publishedIds.length;

  const members: GroupMember[] = memberIds.map((id) => {
    const p = profiles.get(id);
    const done = doneCount.get(id) ?? 0;
    const scores = examScores.get(id);
    return {
      studentId: id,
      name: p?.full_name || "طالب",
      grade: p?.grade ?? "",
      avatarUrl: p?.avatar_url ?? null,
      completedLessons: done,
      totalLessons,
      progressPct: totalLessons ? Math.round((done / totalLessons) * 100) : 0,
      examAvg:
        scores && scores.pct.length
          ? Math.round(
              (scores.pct.reduce((n, x) => n + x, 0) / scores.pct.length) * 10
            ) / 10
          : null,
      examsTaken: scores?.taken ?? 0,
      lastCardTitle: lastCard.get(id) ?? null,
      awaitingReply: lastSender.get(id) === "student",
    };
  });
  members.sort((a, b) => Number(b.awaitingReply) - Number(a.awaitingReply));

  return {
    group: { ...toGroup(groupRow as GroupRow), memberCount: memberIds.length },
    members,
    candidates: candidateIds.map((id) => ({
      studentId: id,
      name: profiles.get(id)?.full_name || "طالب",
      grade: profiles.get(id)?.grade ?? "",
    })),
    announcements: (msgRes.data ?? []) as GroupHub["announcements"],
    exams: ((examRes.data ?? []) as {
      id: string;
      title: string;
      status: "draft" | "published";
      exam_attempts: { status: string }[] | null;
    }[]).map((e) => {
      const attempts = e.exam_attempts ?? [];
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        submittedCount: attempts.filter((a) => a.status !== "in_progress").length,
        needsGrading: attempts.filter((a) => a.status === "submitted").length,
      };
    }),
    restrictedLessons: restricted.map((l) => {
      const granted = grantedPerLesson.get(l.id);
      return {
        id: l.id,
        title: l.title,
        grantedCount: memberIds.filter((m) => granted?.has(m)).length,
      };
    }),
    totalLessons,
  };
}

/* ==================== الاختبارات ==================== */

/** اختبارات المعلّم الحالي مع عدّاداتها */
export async function getMyExams(): Promise<ExamSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("exams")
    .select("*, student_groups(name), exam_questions(points), exam_attempts(status)")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as (Exam & {
    student_groups: { name: string } | { name: string }[] | null;
    exam_questions: { points: number }[] | null;
    exam_attempts: { status: string }[] | null;
  })[]).map((e) => {
    const g = Array.isArray(e.student_groups) ? e.student_groups[0] : e.student_groups;
    const qs = e.exam_questions ?? [];
    const attempts = e.exam_attempts ?? [];
    return {
      ...e,
      groupName: g?.name ?? "مجموعة",
      questionCount: qs.length,
      totalPoints: qs.reduce((n, q) => n + Number(q.points || 0), 0),
      submittedCount: attempts.filter((a) => a.status !== "in_progress").length,
      needsGrading: attempts.filter((a) => a.status === "submitted").length,
    };
  });
}

/** قوالب المعلّم المحفوظة — بنيةُ اختبارٍ يعيد استعمالها */
export async function getMyExamTemplates(): Promise<ExamTemplate[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return [];

  const { data } = await supabase
    .from("exam_templates")
    .select("id, name, description, questions")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as {
    id: string;
    name: string;
    description: string | null;
    questions: unknown;
  }[]).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    questions: Array.isArray(t.questions)
      ? (t.questions as ExamTemplate["questions"])
      : [],
  }));
}

/** اختبار واحد للمعلّم مع أسئلته الكاملة (بالإجابات الصحيحة) */
export async function getMyExam(
  examId: string
): Promise<{ exam: Exam; questions: ExamQuestion[] } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return null;

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!exam) return null;

  const { data: qs } = await supabase
    .from("exam_questions")
    .select("*")
    .eq("exam_id", examId)
    .order("position");

  return {
    exam: exam as Exam,
    questions: ((qs ?? []) as ExamQuestion[]).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
  };
}

/** محاولات الطلاب في اختبار — لشاشة التصحيح */
export async function getExamAttempts(examId: string): Promise<AttemptForGrading[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("exam_attempts")
    .select("*, exam_answers(*)")
    .eq("exam_id", examId)
    .order("submitted_at", { ascending: true });

  const rows = (data ?? []) as (AttemptForGrading & {
    student_id: string;
    exam_answers: AttemptForGrading["answers"];
  })[];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", rows.map((r) => r.student_id));
  const names = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
  );

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: names.get(r.student_id) ?? "طالب",
    status: r.status,
    submitted_at: r.submitted_at,
    auto_score: Number(r.auto_score),
    manual_score: Number(r.manual_score),
    max_score: Number(r.max_score),
    answers: r.exam_answers ?? [],
  }));
}

/** اختبارات الطالب الحالي (من مجموعاته) */
export async function getMyStudentExams(): Promise<StudentExam[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("exams")
      .select("*, teachers(name), exam_questions(points)")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    const exams = (data ?? []) as (Exam & {
      teachers: { name: string } | { name: string }[] | null;
      exam_questions: { points: number }[] | null;
    })[];
    if (exams.length === 0) return [];

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("id, exam_id, status, auto_score, manual_score, max_score")
      .eq("student_id", user.id);
    const byExam = new Map(
      ((attempts ?? []) as { exam_id: string }[]).map((a) => [a.exam_id, a])
    );

    return exams.map((e) => {
      const t = Array.isArray(e.teachers) ? e.teachers[0] : e.teachers;
      const qs = e.exam_questions ?? [];
      const a = byExam.get(e.id) as
        | {
            id: string;
            status: StudentExam["attempt"] extends null ? never : "in_progress" | "submitted" | "graded";
            auto_score: number;
            manual_score: number;
            max_score: number;
          }
        | undefined;
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        teacherName: t?.name ?? "معلّم",
        opens_at: e.opens_at,
        closes_at: e.closes_at,
        duration_minutes: e.duration_minutes,
        questionCount: qs.length,
        totalPoints: qs.reduce((n, q) => n + Number(q.points || 0), 0),
        attempt: a
          ? {
              id: a.id,
              status: a.status,
              auto_score: Number(a.auto_score),
              manual_score: Number(a.manual_score),
              max_score: Number(a.max_score),
            }
          : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * ورقة الأسئلة كما يراها الطالب — بلا إجابات صحيحة.
 *
 * الأسئلة تأتي من `get_exam_paper` لا من الجدول: سياسة `exam_questions`
 * تمنع الطالب أصلاً، والدالة تُسقط `correct_index` و`correct_bool` و
 * `model_answer` قبل أن يصله شيء. إجاباته هو يقرؤها عادياً.
 */
export async function getExamPaper(examId: string): Promise<{
  exam: Exam;
  questions: ExamPaperQuestion[];
  attempt: {
    id: string;
    status: "in_progress" | "submitted" | "graded";
    started_at: string;
    auto_score: number;
    manual_score: number;
    max_score: number;
  } | null;
  myAnswers: ExamAnswer[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return null;

  const { data: qs } = await supabase.rpc("get_exam_paper", { e_id: examId });

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, status, started_at, auto_score, manual_score, max_score")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();

  let myAnswers: ExamAnswer[] = [];
  if (attempt) {
    const { data: ans } = await supabase
      .from("exam_answers")
      .select("*")
      .eq("attempt_id", (attempt as { id: string }).id);
    myAnswers = (ans ?? []) as ExamAnswer[];
  }

  return {
    exam: exam as Exam,
    questions: ((qs ?? []) as ExamPaperQuestion[]).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
    attempt:
      (attempt as {
        id: string;
        status: "in_progress" | "submitted" | "graded";
        started_at: string;
        auto_score: number;
        manual_score: number;
        max_score: number;
      } | null) ?? null,
    myAnswers,
  };
}
