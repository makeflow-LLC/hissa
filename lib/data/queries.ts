import { createClient } from "@/lib/supabase/server";
import type {
  MyTeacher,
  AttachmentRow,
  LessonContent,
  LessonMeta,
  LessonPage,
  LiveSessionRow,
  QuizQuestionRow,
  TeacherCard,
  TeacherProfile,
  TeacherRow,
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

/** دليل المعلمين: كل المعلمين مع عدد دروسهم وحصصهم */
export async function getTeacherCards(): Promise<TeacherCard[]> {
  const supabase = await createClient();

  const [teachersRes, lessonsRes, liveRes] = await Promise.all([
    supabase
      .from("teachers")
      .select(TEACHER_COLS)
      .eq("is_published", true)
      .order("created_at"),
    supabase.from("lessons").select("id, teacher_id").eq("status", "published"),
    supabase.from("live_sessions").select("id, teacher_id").eq("status", "published"),
  ]);

  if (teachersRes.error) throw teachersRes.error;

  const lessonCounts = new Map<string, number>();
  for (const l of lessonsRes.data ?? []) {
    lessonCounts.set(l.teacher_id, (lessonCounts.get(l.teacher_id) ?? 0) + 1);
  }
  const liveCounts = new Map<string, number>();
  for (const s of liveRes.data ?? []) {
    liveCounts.set(s.teacher_id, (liveCounts.get(s.teacher_id) ?? 0) + 1);
  }

  return (teachersRes.data as TeacherRow[]).map((t) => ({
    ...t,
    lessonCount: lessonCounts.get(t.id) ?? 0,
    liveCount: liveCounts.get(t.id) ?? 0,
  }));
}

/** بروفايل معلم: منهجه وحصصه + حالة الطالب الحالي تجاهه */
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

  const [unitsRes, lessonsRes, liveRes] = await Promise.all([
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
    supabase
      .from("live_sessions")
      .select(
        "id, title, description, schedule, duration, seats_left, emoji, gradient, is_paid, price, currency"
      )
      .eq("teacher_id", teacher.id)
      .eq("status", "published")
      .order("created_at"),
  ]);

  const lessons = (lessonsRes.data ?? []) as LessonMeta[];
  const units: UnitWithLessons[] = (unitsRes.data ?? []).map((u) => ({
    ...u,
    lessons: lessons.filter((l) => l.unit_id === u.id),
  }));

  // حالة الطالب: متابعة، دروس منجزة، حصص مسجّل فيها
  let isFollowing = false;
  let completedLessonIds: string[] = [];
  const enrolledSessionIds: Record<string, string> = {};

  if (user) {
    const lessonIds = lessons.map((l) => l.id);
    const sessionIds = (liveRes.data ?? []).map((s) => s.id);

    const [followRes, progressRes, enrollRes] = await Promise.all([
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
      sessionIds.length
        ? supabase
            .from("enrollments")
            .select("session_id, status")
            .eq("student_id", user.id)
            .in("session_id", sessionIds)
        : Promise.resolve({ data: [] as { session_id: string; status: string }[] }),
    ]);

    isFollowing = Boolean(followRes.data);
    completedLessonIds = (progressRes.data ?? []).map((p) => p.lesson_id);
    for (const e of enrollRes.data ?? []) {
      if (e.status !== "cancelled") enrolledSessionIds[e.session_id] = e.status;
    }
  }

  return {
    teacher: teacher as TeacherRow,
    units,
    liveSessions: (liveRes.data ?? []) as LiveSessionRow[],
    isFollowing,
    completedLessonIds,
    enrolledSessionIds,
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

export interface DashboardEnrollment {
  id: string;
  status: string;
  session: LiveSessionRow & { teacherName: string; teacherSlug: string };
}

export interface DashboardTeacherProgress {
  teacher: Pick<TeacherRow, "id" | "slug" | "name" | "subject" | "initials" | "gradient" | "avatar_url">;
  units: { id: string; title: string; total: number; done: number }[];
  total: number;
  done: number;
  /** أول درس غير منجز — زر «أكمل التعلّم» */
  nextLesson: { id: string; title: string } | null;
}

export interface StudentDashboard {
  enrollments: DashboardEnrollment[];
  following: DashboardTeacherProgress[];
}

/** بيانات لوحة الطالب: حصصي + معلّميّ + تقدّمي */
export async function getStudentDashboard(): Promise<StudentDashboard | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [enrollRes, followRes, progressRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        `id, status,
         live_sessions!inner (
           id, title, description, schedule, duration, seats_left, emoji, gradient,
           is_paid, price, currency,
           teachers!inner ( name, slug )
         )`
      )
      .eq("student_id", user.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
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

  type EnrollJoin = {
    id: string;
    status: string;
    live_sessions:
      | (LiveSessionRow & { teachers: { name: string; slug: string } | { name: string; slug: string }[] })
      | (LiveSessionRow & { teachers: { name: string; slug: string } | { name: string; slug: string }[] })[]
      | null;
  };
  const enrollments: DashboardEnrollment[] = [];
  for (const e of (enrollRes.data ?? []) as unknown as EnrollJoin[]) {
    const s = one(e.live_sessions);
    const t = s ? one(s.teachers) : null;
    if (!s || !t) continue;
    const { teachers: _drop, ...session } = s;
    enrollments.push({
      id: e.id,
      status: e.status,
      session: { ...session, teacherName: t.name, teacherSlug: t.slug },
    });
  }

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

  return { enrollments, following };
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
