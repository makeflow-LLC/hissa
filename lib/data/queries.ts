import { createClient } from "@/lib/supabase/server";
import type {
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
  TeacherProfile,
  TeacherRow,
  TeacherStudent,
  UnitWithLessons,
} from "@/lib/data/types";

/** الأعمدة الوصفية للدرس — الوحيدة المتاحة للزائر (انظر 0004_visitor_column_gating.sql) */
const LESSON_META_COLS =
  "id, unit_id, title, description, duration, emoji, gradient, position, is_free_preview";

const TEACHER_COLS =
  "id, slug, name, subject, stages, bio, initials, gradient, avatar_url, whatsapp, rating, rating_count, qualification, experience_years";

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
    supabase.from("lessons").select("id, teacher_id").eq("status", "published"),
    supabase.from("follows").select("teacher_id"),
    supabase.from("units").select("id, teacher_id"),
  ]);

  if (teachersRes.error) throw teachersRes.error;

  const lessonCounts = new Map<string, number>();
  for (const l of lessonsRes.data ?? []) {
    lessonCounts.set(l.teacher_id, (lessonCounts.get(l.teacher_id) ?? 0) + 1);
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

  // حالة الطالب: متابعة، دروس منجزة، وتقييمه إن كتبه
  let isFollowing = false;
  let completedLessonIds: string[] = [];
  let myReview: { rating: number; comment: string } | null = null;

  if (user) {
    const lessonIds = lessons.map((l) => l.id);

    const [followRes, progressRes, reviewRes] = await Promise.all([
      supabase
        .from("follows")
        .select("teacher_id")
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

    isFollowing = Boolean(followRes.data);
    completedLessonIds = (progressRes.data ?? []).map((p) => p.lesson_id);
    myReview = (reviewRes.data as { rating: number; comment: string } | null) ?? null;
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
    isFollowing,
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

  if (!locked) {
    if (user) {
      // المسجّل يقرأ الأعمدة الكاملة مباشرة (صلاحيات authenticated)
      const [contentRes, attRes, quizRes, progressRes] = await Promise.all([
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
      ]);
      content = (contentRes.data as LessonContent) ?? null;
      attachments = (attRes.data ?? []) as AttachmentRow[];
      quiz = (quizRes.data ?? []) as QuizQuestionRow[];
      isCompleted = Boolean(progressRes.data);
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

  const { data: quizRows } = await supabase
    .from("quiz_questions")
    .select("prompt, options, correct_index")
    .eq("lesson_id", lessonId)
    .order("position");

  const rawSections = Array.isArray(row.sections) ? row.sections : [];
  const sections = rawSections.map((s) => {
    const o = s as Record<string, unknown>;
    return {
      heading: String(o.heading ?? ""),
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
  (TeacherMessage & { teacherName: string; teacherSlug: string })[]
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("teacher_messages")
      .select("id, teacher_id, student_id, body, created_at, teachers(name, slug)")
      .order("created_at", { ascending: false })
      .limit(30);

    return (data ?? []).map((m) => {
      const row = m as Record<string, unknown> & {
        teachers: { name: string; slug: string } | { name: string; slug: string }[];
      };
      const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
      return {
        id: String(row.id),
        teacher_id: String(row.teacher_id),
        student_id: (row.student_id as string | null) ?? null,
        body: String(row.body ?? ""),
        created_at: String(row.created_at),
        teacherName: t?.name ?? "معلّم",
        teacherSlug: t?.slug ?? "",
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

  const { data: follows } = await supabase
    .from("follows")
    .select("student_id, created_at")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });
  const followRows = (follows ?? []) as { student_id: string; created_at: string }[];
  if (followRows.length === 0) return [];

  const studentIds = followRows.map((f) => f.student_id);

  const [profilesRes, lessonsRes, grantsRes] = await Promise.all([
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
  ]);

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
    };
  });
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
