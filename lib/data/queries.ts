import { createClient } from "@/lib/supabase/server";

/**
 * معرّفُ الوحدة الصوريّة التي تُجمع فيها الدروس بلا وحدة.
 * ثابتٌ لا UUID حقيقيّ: لا صفّ له في `units`، وإنما مفتاح عرضٍ فقط.
 */
export const LOOSE_UNIT_ID = "__loose__";
import { normalizeSubject } from "@/lib/arabic";
import type { ExamTemplate } from "@/lib/examTemplates";
import type {
  ActivityItem,
  ActivityKind,
  ActivityTemplate,
} from "@/lib/activityKinds";
import type {
  ContentSection,
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
  Activity,
  ActivityPlayRow,
  ActivitySummary,
  StudentActivity,
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
  "id, slug, name, subject, stages, bio, initials, gradient, avatar_url, whatsapp, phone, contact_public, rating, rating_count, qualification, experience_years, join_instructions, availability, availability_note";

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
    // `owner_id` يُقرأ هنا للتمييز بين المعلّم ومن سواه، ولا يُعاد في
    // الصفّ المُخرَج: كل ما يخرج من هنا يصل المتصفّح
    .select(`${TEACHER_COLS}, owner_id`)
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

  /**
   * الدروس بلا وحدة تُعرض في وحدةٍ صوريّة في آخر المنهج.
   *
   * كانت تُسقَط: التوزيع على الوحدات لا يطابق `unit_id = null`، فيختفي
   * الدرس من صفحة المعلّم — ويعيد `getLessonPage` أدناه 404 للطالب الذي
   * يفتح رابطه. والوحدة اختيارية أصلاً، **ومصمّم الدروس يحفظ بلا وحدة
   * افتراضياً**، فالحالة عاديّة لا نادرة.
   */
  const loose = lessons.filter((l) => !l.unit_id);
  if (loose.length > 0) {
    units.push({
      id: LOOSE_UNIT_ID,
      title: "دروس أخرى",
      description: "",
      position: 9999,
      lessons: loose,
    });
  }

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

  /*
   * **الرقم يُحذف من الصفّ نفسه، لا من الواجهة.**
   *
   * `TeacherTabs` مكوّنٌ عميل يستقبل `profile` كاملاً، فكل حقلٍ فيه
   * يُسلسَل داخل حمولة RSC ويُقرأ من «مصدر الصفحة» مهما أخفاه الشرط في
   * JSX. وقد كشف اختبارُ متصفّحٍ رقمَ الواتساب للزائر بهذه الطريقة
   * بالضبط، بينما الزرّ نفسه لم يكن ظاهراً: إخفاءٌ يُطمئن ولا يحمي.
   *
   * فمن يستحقّ الرقم؟ صاحبه، وعضو إحدى مجموعاته، ومستخدمٌ مسجّلٌ إن أذِن
   * المعلّم بنشره (`contact_public`). وما عدا ذلك يخرج فارغاً من هنا.
   */
  const { owner_id: ownerId, ...publicTeacher } = teacher as TeacherRow & {
    owner_id: string;
  };
  const isOwner = Boolean(user && ownerId === user.id);
  const maySeeContact =
    isOwner ||
    inTeacherGroup ||
    (Boolean(user) && publicTeacher.contact_public !== false);

  return {
    teacher: {
      ...publicTeacher,
      whatsapp: maySeeContact ? publicTeacher.whatsapp : null,
      phone: maySeeContact ? publicTeacher.phone : null,
    },
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
  // الدروس بلا وحدة تُلحَق بالآخر — بدونها يعود الدرس 404 لطالبٍ يفتح رابطه
  const ordered = [
    ...units.flatMap((u) => allLessons.filter((l) => l.unit_id === u.id)),
    ...allLessons.filter((l) => !l.unit_id),
  ];

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
    // وهنا كذلك: بدون الملحق تُحسب نسبة تقدّمٍ من مجموعٍ ناقص
    const loose = lessons.filter((l) => !l.unit_id);
    const ordered = [
      ...units.flatMap((u) => lessons.filter((l) => l.unit_id === u.id)),
      ...loose,
    ];
    const nextUndone = ordered.find((l) => !doneIds.has(l.id)) ?? null;

    following.push({
      teacher: t,
      units: [
        ...units.map((u) => {
          const unitLessons = lessons.filter((l) => l.unit_id === u.id);
          return {
            id: u.id,
            title: u.title,
            total: unitLessons.length,
            done: unitLessons.filter((l) => doneIds.has(l.id)).length,
          };
        }),
        ...(loose.length > 0
          ? [{
              id: LOOSE_UNIT_ID,
              title: "دروس أخرى",
              total: loose.length,
              done: loose.filter((l) => doneIds.has(l.id)).length,
            }]
          : []),
      ],
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
  /**
   * دروسٌ لا وحدة لها.
   *
   * كانت تُسقَط إسقاطاً: الدروس تُوزَّع على وحداتها و`unit_id = null` لا
   * يطابق أيّ وحدة، فيختفي الدرس من مدير المحتوى كأنه لم يُحفظ — ولا
   * يظنّ المعلّم إلا أن الحفظ فشل. والوحدة اختيارية أصلاً، ومصمّم الدروس
   * يحفظ بلا وحدة افتراضياً، فالحالة عاديّة لا نادرة.
   */
  looseLessons: TeacherUnit["lessons"];
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
    looseLessons: lessons.filter((l) => !l.unit_id),
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


/** نتيجة طالب في اختبار، لعرضها على لوحة المعلّم */
export interface ExamResultRow {
  attemptId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  status: "submitted" | "graded";
  score: number;
  maxScore: number;
  pct: number;
  submitted_at: string | null;
}

/**
 * أحدث نتائج طلاب المعلّم في اختباراته.
 *
 * على لوحته مباشرةً: المعلّم يريد أن يعرف من قدّم وكم أخذ دون أن يفتح كل
 * اختبار على حدة. المحاولات الجارية مستبعَدة — لا نتيجة لورقةٍ لم تُسلَّم.
 */
export async function getRecentExamResults(limit = 12): Promise<ExamResultRow[]> {
  try {
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
      .select(
        "id, title, exam_attempts(id, student_id, status, auto_score, manual_score, max_score, submitted_at)"
      )
      .eq("teacher_id", teacher.id);

    const rows = ((data ?? []) as {
      id: string;
      title: string;
      exam_attempts:
        | {
            id: string;
            student_id: string;
            status: string;
            auto_score: number;
            manual_score: number;
            max_score: number;
            submitted_at: string | null;
          }[]
        | null;
    }[]).flatMap((e) =>
      (e.exam_attempts ?? [])
        .filter((a) => a.status !== "in_progress")
        .map((a) => {
          const score = Number(a.auto_score) + Number(a.manual_score);
          const max = Number(a.max_score);
          return {
            attemptId: a.id,
            examId: e.id,
            examTitle: e.title,
            studentId: a.student_id,
            studentName: "طالب",
            status: a.status as "submitted" | "graded",
            score,
            maxScore: max,
            pct: max > 0 ? Math.round((score / max) * 100) : 0,
            submitted_at: a.submitted_at,
          };
        })
    );

    if (rows.length === 0) return [];

    rows.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
    const top = rows.slice(0, limit);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(top.map((r) => r.studentId))]);
    const names = new Map(
      ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [
        p.id,
        p.full_name,
      ])
    );

    return top.map((r) => ({ ...r, studentName: names.get(r.studentId) || "طالب" }));
  } catch {
    return [];
  }
}

/* ==================== ملفّ الطالب عند معلّمه ==================== */

/** كل ما يعرفه المعلّم عن طالب واحد، مجموعاً في صفحة واحدة */
export interface StudentDetail {
  profile: StudentProfile;
  followedAt: string;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  /** الدروس التي أنهاها، بأسمائها */
  doneLessons: { id: string; title: string }[];
  groups: { id: string; name: string }[];
  grants: { id: string; lesson_id: string | null; session_id: string | null }[];
  /** نتائجه في اختبارات هذا المعلّم */
  exams: {
    attemptId: string;
    examId: string;
    title: string;
    status: "in_progress" | "submitted" | "graded";
    score: number;
    maxScore: number;
    pct: number;
    submitted_at: string | null;
  }[];
  /** نتائجه في اختبارات الدروس القصيرة */
  quizzes: { lessonId: string; lessonTitle: string; score: number; total: number }[];
  cards: ReportCard[];
  parentReports: ParentReport[];
  messages: { id: string; body: string; created_at: string; sender: string }[];
}

/**
 * ملفّ طالب واحد كما يراه معلّمه.
 *
 * صفحة مستقلّة بدل حشو كل هذا في بطاقةٍ داخل قائمة الطلاب: القائمة صارت
 * قائمةً يُمسحها المعلّم بعينه، والتفصيل يُفتح عند الحاجة إليه.
 *
 * كل استعلام مقيّد بـ `teacher_id` أو بمعرّف الطالب: تمرير معرّف طالب لا
 * ينضمّ إلى هذا المعلّم يعيد `null` قبل قراءة أي شيء آخر.
 */
export async function getStudentForTeacher(
  studentId: string
): Promise<StudentDetail | null> {
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

  // لا يُفتح ملفّ إلا لطالب قَبِله هذا المعلّم فعلاً
  const { data: follow } = await supabase
    .from("follows")
    .select("created_at")
    .eq("teacher_id", teacher.id)
    .eq("student_id", studentId)
    .eq("status", "approved")
    .maybeSingle();
  if (!follow) return null;

  const [
    profileRes,
    lessonsRes,
    groupsRes,
    grantsRes,
    cardsRes,
    reportsRes,
    msgRes,
    examRes,
  ] = await Promise.all([
    supabase.from("profiles").select(STUDENT_PROFILE_COLS).eq("id", studentId).maybeSingle(),
    supabase
      .from("lessons")
      .select("id, title")
      .eq("teacher_id", teacher.id)
      .eq("status", "published"),
    supabase
      .from("student_groups")
      .select("id, name, student_group_members(student_id)")
      .eq("teacher_id", teacher.id),
    supabase
      .from("student_grants")
      .select("id, lesson_id, session_id")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId),
    supabase
      .from("report_cards")
      .select("*")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("parent_reports")
      .select("*")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_messages")
      .select("id, body, created_at, sender")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("exams")
      .select("id, title, exam_attempts(id, student_id, status, auto_score, manual_score, max_score, submitted_at)")
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: false }),
  ]);

  const lessons = (lessonsRes.data ?? []) as { id: string; title: string }[];
  const lessonIds = lessons.map((l) => l.id);
  const titleOf = new Map(lessons.map((l) => [l.id, l.title]));

  const [progressRes, quizRes] = await Promise.all([
    lessonIds.length
      ? supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", studentId)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length
      ? supabase
          .from("quiz_attempts")
          .select("lesson_id, score, total")
          .eq("student_id", studentId)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const done = ((progressRes.data ?? []) as { lesson_id: string }[]).map(
    (p) => p.lesson_id
  );
  const totalLessons = lessonIds.length;

  const profile =
    (profileRes.data as StudentProfile | null) ??
    ({
      id: studentId,
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

  const exams = ((examRes.data ?? []) as {
    id: string;
    title: string;
    exam_attempts:
      | {
          id: string;
          student_id: string;
          status: "in_progress" | "submitted" | "graded";
          auto_score: number;
          manual_score: number;
          max_score: number;
          submitted_at: string | null;
        }[]
      | null;
  }[])
    .map((e) => {
      const a = (e.exam_attempts ?? []).find((x) => x.student_id === studentId);
      if (!a) return null;
      const score = Number(a.auto_score) + Number(a.manual_score);
      const max = Number(a.max_score);
      return {
        attemptId: a.id,
        examId: e.id,
        title: e.title,
        status: a.status,
        score,
        maxScore: max,
        pct: max > 0 ? Math.round((score / max) * 100) : 0,
        submitted_at: a.submitted_at,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    profile,
    followedAt: (follow as { created_at: string }).created_at,
    completedLessons: done.length,
    totalLessons,
    progressPct: totalLessons ? Math.round((done.length / totalLessons) * 100) : 0,
    doneLessons: done.map((id) => ({ id, title: titleOf.get(id) ?? "درس" })),
    groups: ((groupsRes.data ?? []) as {
      id: string;
      name: string;
      student_group_members: { student_id: string }[] | null;
    }[])
      .filter((g) => (g.student_group_members ?? []).some((m) => m.student_id === studentId))
      .map((g) => ({ id: g.id, name: g.name })),
    grants: (grantsRes.data ?? []) as StudentDetail["grants"],
    exams,
    quizzes: ((quizRes.data ?? []) as {
      lesson_id: string;
      score: number;
      total: number;
    }[]).map((q) => ({
      lessonId: q.lesson_id,
      lessonTitle: titleOf.get(q.lesson_id) ?? "درس",
      score: Number(q.score),
      total: Number(q.total),
    })),
    cards: (cardsRes.data ?? []) as ReportCard[],
    parentReports: (reportsRes.data ?? []) as ParentReport[],
    messages: (msgRes.data ?? []) as StudentDetail["messages"],
  };
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

/* ==================== الأنشطة التفاعلية ==================== */

/** أنشطة المعلّم الحالي مع عدّاداتها */
export async function getMyActivities(): Promise<ActivitySummary[]> {
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
    .from("activities")
    .select("*, student_groups(name), activity_plays(student_id)")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as (Activity & {
    student_groups: { name: string } | { name: string }[] | null;
    activity_plays: { student_id: string }[] | null;
  })[]).map((a) => {
    const g = Array.isArray(a.student_groups) ? a.student_groups[0] : a.student_groups;
    const plays = a.activity_plays ?? [];
    return {
      ...a,
      items: Array.isArray(a.items) ? a.items : [],
      audience: g?.name ?? "كل طلابي",
      playCount: plays.length,
      playerCount: new Set(plays.map((p) => p.student_id)).size,
    };
  });
}

/** نشاط واحد للمعلّم — لصفحة تحريره */
export async function getMyActivity(id: string): Promise<Activity | null> {
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

  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!data) return null;

  const a = data as Activity;
  return { ...a, items: Array.isArray(a.items) ? a.items : [] };
}

/** لعبات الطلاب في نشاط — لصفحة نتائجه */
export async function getActivityPlays(activityId: string): Promise<ActivityPlayRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("activity_plays")
    .select("id, student_id, score, total, seconds, played_at")
    .eq("activity_id", activityId)
    .order("played_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as {
    id: string;
    student_id: string;
    score: number;
    total: number;
    seconds: number;
    played_at: string;
  }[];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(rows.map((r) => r.student_id))]);
  const names = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
  );

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: names.get(r.student_id) || "طالب",
    score: Number(r.score),
    total: Number(r.total),
    seconds: r.seconds,
    played_at: r.played_at,
  }));
}

/** أنشطة الطالب الحالي — ما نُشر وهو مخوّل بلعبه (RLS هي المرشِّح) */
export async function getMyStudentActivities(): Promise<StudentActivity[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const [{ data }, { data: plays }] = await Promise.all([
      supabase
        .from("activities")
        .select("id, title, instructions, kind, items, image_url, show_leaderboard, teachers(name)")
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_plays")
        .select("activity_id, score, total")
        .eq("student_id", user.id),
    ]);

    const best = new Map<string, { score: number; total: number; plays: number }>();
    for (const p of (plays ?? []) as {
      activity_id: string;
      score: number;
      total: number;
    }[]) {
      const cur = best.get(p.activity_id);
      const score = Number(p.score);
      if (!cur) best.set(p.activity_id, { score, total: Number(p.total), plays: 1 });
      else {
        cur.plays += 1;
        if (score > cur.score) {
          cur.score = score;
          cur.total = Number(p.total);
        }
      }
    }

    return ((data ?? []) as {
      id: string;
      title: string;
      instructions: string;
      kind: ActivityKind;
      items: unknown;
      image_url: string | null;
      show_leaderboard: boolean;
      teachers: { name: string } | { name: string }[] | null;
    }[]).map((a) => {
      const t = Array.isArray(a.teachers) ? a.teachers[0] : a.teachers;
      const b = best.get(a.id);
      return {
        id: a.id,
        title: a.title,
        instructions: a.instructions,
        kind: a.kind,
        items: Array.isArray(a.items) ? (a.items as ActivityItem[]) : [],
        teacherName: t?.name ?? "معلّم",
        imageUrl: a.image_url ?? "",
        showLeaderboard: a.show_leaderboard !== false,
        bestScore: b ? b.score : null,
        bestTotal: b ? b.total : null,
        plays: b?.plays ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/** نشاط واحد ليلعبه الطالب — تُرشّحه RLS، فما وصل جاز لعبه */
export async function getActivityToPlay(id: string): Promise<StudentActivity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("activities")
    .select("id, title, instructions, kind, items, image_url, show_leaderboard, teachers(name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;

  const row = data as {
    id: string;
    title: string;
    instructions: string;
    kind: ActivityKind;
    items: unknown;
    image_url: string | null;
    show_leaderboard: boolean;
    teachers: { name: string } | { name: string }[] | null;
  };
  const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;

  const { data: plays } = await supabase
    .from("activity_plays")
    .select("score, total")
    .eq("activity_id", id)
    .eq("student_id", user.id);

  const list = (plays ?? []) as { score: number; total: number }[];
  const top = list.reduce<{ score: number; total: number } | null>(
    (acc, p) => (!acc || Number(p.score) > acc.score
      ? { score: Number(p.score), total: Number(p.total) }
      : acc),
    null
  );

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    kind: row.kind,
    items: Array.isArray(row.items) ? (row.items as ActivityItem[]) : [],
    teacherName: t?.name ?? "معلّم",
    imageUrl: row.image_url ?? "",
    showLeaderboard: row.show_leaderboard !== false,
    bestScore: top?.score ?? null,
    bestTotal: top?.total ?? null,
    plays: list.length,
  };
}

/** قوالب الأنشطة التي حفظها المعلّم */
export async function getMyActivityTemplates(): Promise<ActivityTemplate[]> {
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
    .from("activity_templates")
    .select("id, name, kind, items")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as {
    id: string;
    name: string;
    kind: ActivityKind;
    items: unknown;
  }[]).map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    items: Array.isArray(t.items) ? (t.items as ActivityItem[]) : [],
  }));
}

/** صفّ في لوحة صدارة نشاط */
export interface LeaderRow {
  studentId: string;
  name: string;
  best: number;
  total: number;
  plays: number;
}

/**
 * لوحة صدارة نشاط — أفضل نتيجة لكل طالب.
 *
 * عبر دالّة `security definer`: سياسة `activity_plays` تقصر الطالب على
 * لعباته هو، ولا نريد فتح الجدول كلّه لقراءة مباشرة لمجرّد عرض ترتيب.
 */
export async function getActivityLeaderboard(
  activityId: string,
  top = 10
): Promise<LeaderRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("activity_leaderboard", {
      a_id: activityId,
      top,
    });
    return ((data ?? []) as {
      student_id: string;
      name: string;
      best: number;
      total: number;
      plays: number;
    }[]).map((r) => ({
      studentId: r.student_id,
      name: r.name,
      best: Number(r.best),
      total: Number(r.total),
      plays: Number(r.plays),
    }));
  } catch {
    return [];
  }
}

/* ==================== الرصيد والإدارة ==================== */

/** رصيد المعلّم الحالي — للعرض؛ الحارس الحقيقيّ `spend_credits` في القاعدة */
export async function getMyCredits(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase
    .from("teachers")
    .select("credits")
    .eq("owner_id", user.id)
    .maybeSingle();
  return Number(data?.credits ?? 0);
}

/**
 * هل المستخدم من الإدارة؟
 *
 * عبر `is_admin()` لا بقراءة `admins`: الجدول مغلقٌ على الواجهة عمداً،
 * لأن قائمةً بأسماء من يملك المنصّة أول ما يطلبه مهاجم. **يفشل مغلقاً**:
 * أيّ خطأ يعني «لا».
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export interface AdminTeacherRow {
  id: string;
  name: string;
  slug: string;
  subject: string;
  email: string;
  credits: number;
  usedCredits: number;
  createdAt: string;
}

/** قائمة المعلّمين وأرصدتهم — تعود فارغة لغير الإدارة (الدالّة تشترط `is_admin()`) */
export async function getAdminTeachers(): Promise<AdminTeacherRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_teacher_list");
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    slug: String(r.slug ?? ""),
    subject: String(r.subject ?? ""),
    email: String(r.email ?? ""),
    credits: Number(r.credits ?? 0),
    usedCredits: Number(r.used_credits ?? 0),
    createdAt: String(r.created_at ?? ""),
  }));
}

export interface PosterRow {
  id: string;
  kind: string;
  title: string;
  imageUrl: string;
  createdAt: string;
}

/** ملصقات درسٍ بعينه — مقيّدةٌ بمالكه عبر RLS */
export async function getLessonPosters(lessonId: string): Promise<PosterRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_posters")
    .select("id, kind, title, image_url, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: String(r.kind ?? "poster"),
    title: String(r.title ?? ""),
    imageUrl: String(r.image_url ?? ""),
    createdAt: String(r.created_at ?? ""),
  }));
}

/* ==================== بنك الأسئلة ==================== */

export interface LessonQuestionRow {
  id: string;
  body: string;
  answer: string;
  answeredAt: string | null;
  createdAt: string;
  hidden: boolean;
  mine: boolean;
  votes: number;
  votedByMe: boolean;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
}

/** أسئلة درسٍ واحد كما يراها الطالب — RLS يرشّح المُجاب من غيره */
export async function getLessonQuestions(
  lessonId: string
): Promise<LessonQuestionRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("lesson_questions")
    .select("id, body, answer, answered_at, created_at, hidden, student_id, lesson_id")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => String(r.id));
  const { data: votes } = await supabase
    .from("question_votes")
    .select("question_id, student_id")
    .in("question_id", ids);
  const all = (votes ?? []) as { question_id: string; student_id: string }[];

  return rows.map((r) => {
    const id = String(r.id);
    const mine = all.filter((v) => v.question_id === id);
    return {
      id,
      body: String(r.body ?? ""),
      answer: String(r.answer ?? ""),
      answeredAt: (r.answered_at as string | null) ?? null,
      createdAt: String(r.created_at ?? ""),
      hidden: Boolean(r.hidden),
      mine: r.student_id === user.id,
      votes: mine.length,
      votedByMe: mine.some((v) => v.student_id === user.id),
      studentName: "",
      lessonId: String(r.lesson_id ?? ""),
      lessonTitle: "",
    };
  });
}

/**
 * صندوق أسئلة المعلّم — **غير المُجاب أولاً، والأكثر تصويتاً قبله**.
 *
 * الترتيب هو الميزة: سؤالٌ يشترك فيه خمسة طلاب يستحقّ جواباً قبل سؤالٍ
 * انفرد به واحد، وإجابته تنفع الخمسة دفعةً واحدة.
 */
export async function getQuestionInbox(): Promise<LessonQuestionRow[]> {
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
    .from("lesson_questions")
    .select(
      "id, body, answer, answered_at, created_at, hidden, student_id, lesson_id, lessons(title), profiles:student_id(full_name)"
    )
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => String(r.id));
  const { data: votes } = await supabase
    .from("question_votes")
    .select("question_id")
    .in("question_id", ids);
  const counts = new Map<string, number>();
  for (const v of (votes ?? []) as { question_id: string }[])
    counts.set(v.question_id, (counts.get(v.question_id) ?? 0) + 1);

  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;

  return rows
    .map((r) => ({
      id: String(r.id),
      body: String(r.body ?? ""),
      answer: String(r.answer ?? ""),
      answeredAt: (r.answered_at as string | null) ?? null,
      createdAt: String(r.created_at ?? ""),
      hidden: Boolean(r.hidden),
      mine: false,
      votes: counts.get(String(r.id)) ?? 0,
      votedByMe: false,
      studentName: String(one(r.profiles)?.full_name ?? "طالب"),
      lessonId: String(r.lesson_id ?? ""),
      lessonTitle: String(one(r.lessons)?.title ?? ""),
    }))
    .sort((a, b) => {
      const aw = a.answeredAt ? 1 : 0;
      const bw = b.answeredAt ? 1 : 0;
      if (aw !== bw) return aw - bw; // غير المُجاب أولاً
      if (a.votes !== b.votes) return b.votes - a.votes;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
}

/* ==================== المراجعة المتباعدة ==================== */

export interface DueReview {
  lessonId: string;
  lessonTitle: string;
  teacherSlug: string;
  teacherName: string;
  stage: number;
  dueAt: string;
}

/** الدروس التي حان وقت مراجعتها */
export async function getDueReviews(): Promise<DueReview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("lesson_reviews")
    .select("lesson_id, stage, due_at, lessons(title, teachers(slug, name))")
    .eq("student_id", user.id)
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(30);

  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;

  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const lesson = one(r.lessons);
      const teacher = one(lesson?.teachers);
      return {
        lessonId: String(r.lesson_id ?? ""),
        lessonTitle: String(lesson?.title ?? ""),
        teacherSlug: String(teacher?.slug ?? ""),
        teacherName: String(teacher?.name ?? ""),
        stage: Number(r.stage ?? 0),
        dueAt: String(r.due_at ?? ""),
      };
    })
    .filter((r) => r.lessonTitle);
}

/** أسئلة درسٍ لجلسة مراجعة — من اختبار الدرس نفسه */
export async function getReviewQuestions(lessonId: string): Promise<QuizQuestionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, prompt, options, correct_index")
    .eq("lesson_id", lessonId)
    .order("position");
  return (data ?? []) as QuizQuestionRow[];
}

/* ==================== الواجبات ==================== */

export interface AssignmentRow {
  id: string;
  title: string;
  body: string;
  dueAt: string | null;
  status: string;
  groupName: string;
  lessonTitle: string;
  createdAt: string;
  submitted: number;
  targets: number;
  ungraded: number;
}

/** واجبات المعلّم مع عدّاد التسليم */
export async function getTeacherAssignments(): Promise<AssignmentRow[]> {
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

  const [aRes, followRes] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, title, body, due_at, status, created_at, group_id, student_groups(name), lessons(title), assignment_submissions(id, graded_at)"
      )
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("student_id", { count: "exact", head: true })
      .eq("teacher_id", teacher.id)
      .eq("status", "approved"),
  ]);

  const approved = followRes.count ?? 0;
  const memberCounts = new Map<string, number>();
  const groupIds = ((aRes.data ?? []) as Record<string, unknown>[])
    .map((r) => r.group_id)
    .filter(Boolean) as string[];
  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from("student_group_members")
      .select("group_id")
      .in("group_id", groupIds);
    for (const m of (members ?? []) as { group_id: string }[])
      memberCounts.set(m.group_id, (memberCounts.get(m.group_id) ?? 0) + 1);
  }

  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;

  return ((aRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const subs = (r.assignment_submissions ?? []) as { id: string; graded_at: string | null }[];
    const gid = r.group_id as string | null;
    return {
      id: String(r.id),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      dueAt: (r.due_at as string | null) ?? null,
      status: String(r.status ?? "draft"),
      groupName: String(one(r.student_groups)?.name ?? "كل طلابي"),
      lessonTitle: String(one(r.lessons)?.title ?? ""),
      createdAt: String(r.created_at ?? ""),
      submitted: subs.length,
      targets: gid ? (memberCounts.get(gid) ?? 0) : approved,
      ungraded: subs.filter((s) => !s.graded_at).length,
    };
  });
}

export interface SubmissionRow {
  id: string;
  studentId: string;
  studentName: string;
  body: string;
  fileUrl: string | null;
  submittedAt: string;
  grade: number | null;
  feedback: string;
  gradedAt: string | null;
  late: boolean;
}

/** لوحة واجبٍ واحد: من سلّم وماذا كتب */
export async function getAssignmentBoard(assignmentId: string): Promise<{
  assignment: AssignmentRow;
  submissions: SubmissionRow[];
} | null> {
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

  // الملكية شرطٌ في الاستعلام نفسه — معرّفٌ غريب لا يفتح شيئاً
  const { data: a } = await supabase
    .from("assignments")
    .select("id, title, body, due_at, status, created_at, group_id, student_groups(name), lessons(title)")
    .eq("id", assignmentId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!a) return null;

  const { data: subs } = await supabase
    .from("assignment_submissions")
    .select("id, student_id, body, file_url, submitted_at, grade, feedback, graded_at, profiles:student_id(full_name)")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;
  const row = a as Record<string, unknown>;
  const due = (row.due_at as string | null) ?? null;

  return {
    assignment: {
      id: String(row.id),
      title: String(row.title ?? ""),
      body: String(row.body ?? ""),
      dueAt: due,
      status: String(row.status ?? "draft"),
      groupName: String(one(row.student_groups)?.name ?? "كل طلابي"),
      lessonTitle: String(one(row.lessons)?.title ?? ""),
      createdAt: String(row.created_at ?? ""),
      submitted: (subs ?? []).length,
      targets: 0,
      ungraded: 0,
    },
    submissions: ((subs ?? []) as Record<string, unknown>[]).map((s) => ({
      id: String(s.id),
      studentId: String(s.student_id ?? ""),
      studentName: String(one(s.profiles)?.full_name ?? "طالب"),
      body: String(s.body ?? ""),
      fileUrl: (s.file_url as string | null) ?? null,
      submittedAt: String(s.submitted_at ?? ""),
      grade: s.grade === null || s.grade === undefined ? null : Number(s.grade),
      feedback: String(s.feedback ?? ""),
      gradedAt: (s.graded_at as string | null) ?? null,
      late: Boolean(due && String(s.submitted_at) > due),
    })),
  };
}

export interface StudentAssignment {
  id: string;
  title: string;
  body: string;
  dueAt: string | null;
  teacherName: string;
  lessonTitle: string;
  submittedAt: string | null;
  grade: number | null;
  feedback: string;
  myBody: string;
}

/** واجبات الطالب — RLS يرشّح ما يخصّه */
export async function getMyAssignments(): Promise<StudentAssignment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("assignments")
    .select("id, title, body, due_at, teachers(name), lessons(title)")
    .eq("status", "published")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const { data: mine } = await supabase
    .from("assignment_submissions")
    .select("assignment_id, body, submitted_at, grade, feedback")
    .eq("student_id", user.id)
    .in("assignment_id", rows.map((r) => String(r.id)));

  const byId = new Map(
    ((mine ?? []) as Record<string, unknown>[]).map((s) => [String(s.assignment_id), s])
  );
  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;

  return rows.map((r) => {
    const s = byId.get(String(r.id));
    return {
      id: String(r.id),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      dueAt: (r.due_at as string | null) ?? null,
      teacherName: String(one(r.teachers)?.name ?? ""),
      lessonTitle: String(one(r.lessons)?.title ?? ""),
      submittedAt: s ? String(s.submitted_at) : null,
      grade: s && s.grade !== null && s.grade !== undefined ? Number(s.grade) : null,
      feedback: s ? String(s.feedback ?? "") : "",
      myBody: s ? String(s.body ?? "") : "",
    };
  });
}

/* ==================== النقاط والتشخيص ==================== */

export interface StudentStats {
  lessonsDone: number;
  activities: number;
  examsDone: number;
  reviewsDone: number;
  onTime: number;
  points: number;
  streakDays: number;
  activeDays: number;
}

/** نقاط الطالب — **محسوبةٌ من جداول النشاط لا من سجلٍّ يُكتب** */
export async function getStudentStats(): Promise<StudentStats> {
  const empty: StudentStats = {
    lessonsDone: 0, activities: 0, examsDone: 0, reviewsDone: 0,
    onTime: 0, points: 0, streakDays: 0, activeDays: 0,
  };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("student_points");
    if (error) return empty;
    const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!r) return empty;
    return {
      lessonsDone: Number(r.lessons_done ?? 0),
      activities: Number(r.activities ?? 0),
      examsDone: Number(r.exams_done ?? 0),
      reviewsDone: Number(r.reviews_done ?? 0),
      onTime: Number(r.on_time ?? 0),
      points: Number(r.points ?? 0),
      streakDays: Number(r.streak_days ?? 0),
      activeDays: Number(r.active_days ?? 0),
    };
  } catch {
    return empty;
  }
}

export interface Insights {
  hardQuestions: {
    examId: string; examTitle: string; prompt: string;
    answered: number; wrong: number; wrongPct: number;
  }[];
  quietStudents: {
    studentId: string; name: string; grade: string;
    lastSeen: string | null; quietDays: number;
  }[];
  lessonReach: {
    lessonId: string; title: string; unit: string;
    done: number; students: number; pct: number;
  }[];
}

/** لوحة التشخيص — ثلاث قراءات مشتقّة، بلا جدولٍ جديد */
export async function getInsights(): Promise<Insights> {
  const supabase = await createClient();
  const [hard, quiet, reach] = await Promise.all([
    supabase.rpc("teacher_hard_questions", { top: 10 }),
    supabase.rpc("teacher_quiet_students", { days: 14 }),
    supabase.rpc("teacher_lesson_reach"),
  ]);

  return {
    hardQuestions: ((hard.data ?? []) as Record<string, unknown>[]).map((r) => ({
      examId: String(r.exam_id ?? ""),
      examTitle: String(r.exam_title ?? ""),
      prompt: String(r.prompt ?? ""),
      answered: Number(r.answered ?? 0),
      wrong: Number(r.wrong ?? 0),
      wrongPct: Number(r.wrong_pct ?? 0),
    })),
    quietStudents: ((quiet.data ?? []) as Record<string, unknown>[]).map((r) => ({
      studentId: String(r.student_id ?? ""),
      name: String(r.name ?? "طالب"),
      grade: String(r.grade ?? ""),
      lastSeen: (r.last_seen as string | null) ?? null,
      quietDays: Number(r.quiet_days ?? 0),
    })),
    lessonReach: ((reach.data ?? []) as Record<string, unknown>[]).map((r) => ({
      lessonId: String(r.lesson_id ?? ""),
      title: String(r.title ?? ""),
      unit: String(r.unit ?? ""),
      done: Number(r.done ?? 0),
      students: Number(r.students ?? 0),
      pct: Number(r.pct ?? 0),
    })),
  };
}

/**
 * هل المستخدم الحالي طالبٌ قَبِله هذا المعلّم؟
 *
 * عبر `is_approved_of` — نفس الشرط الذي تفرضه سياسات القاعدة، فلا يختلف
 * ما تُظهره الواجهة عمّا تسمح به القاعدة. **يفشل مغلقاً**.
 */
export async function isApprovedStudentOf(teacherId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_approved_of", { t_id: teacherId });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/* ==================== مستويات القراءة ==================== */

export interface LevelSections {
  level: "simple" | "advanced";
  sections: ContentSection[];
}

/**
 * نسخ الدرس بمستوياتها.
 *
 * السياسة ترث بوّابة `lessons`: لا يقرأها إلا من يقرأ الدرس الأصلي،
 * والزائر ممنوعٌ من الجدول كلّه. فلا حاجة إلى فحصٍ ثانٍ هنا.
 */
export async function getLessonLevels(lessonId: string): Promise<LevelSections[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lesson_levels")
      .select("level, sections")
      .eq("lesson_id", lessonId);
    return ((data ?? []) as Record<string, unknown>[])
      .map((r) => ({
        level: String(r.level) as "simple" | "advanced",
        sections: (Array.isArray(r.sections) ? r.sections : []) as ContentSection[],
      }))
      .filter((r) => r.sections.length > 0);
  } catch {
    return [];
  }
}

/** ورقة العمل: الدرس وأسئلته ومعلّمه — للمعلّم صاحبه وحده */
export async function getWorksheetData(lessonId: string): Promise<{
  lesson: { id: string; title: string; description: string; duration: string };
  teacherName: string;
  sections: ContentSection[];
  levels: LevelSections[];
  quiz: QuizQuestionRow[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return null;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, description, duration, sections")
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!lesson) return null;

  const [levels, quizRes] = await Promise.all([
    getLessonLevels(lessonId),
    supabase
      .from("quiz_questions")
      .select("id, prompt, options, correct_index")
      .eq("lesson_id", lessonId)
      .order("position"),
  ]);

  return {
    lesson: {
      id: String(lesson.id),
      title: String(lesson.title ?? ""),
      description: String(lesson.description ?? ""),
      duration: String(lesson.duration ?? ""),
    },
    teacherName: String(teacher.name ?? ""),
    sections: (Array.isArray(lesson.sections) ? lesson.sections : []) as ContentSection[],
    levels,
    quiz: (quizRes.data ?? []) as QuizQuestionRow[],
  };
}

/* ==================== حجز موعدٍ مع المعلّم ==================== */

/** موعدٌ فتحه المعلّم، كما يراه الطالب */
export interface SlotRow {
  id: string;
  startsAt: string;
  minutes: number;
  /** `null` = «يُتّفق عليه»، و0 = مجاني. عرضٌ فقط — لا مال يمرّ بالمنصّة */
  price: number | null;
  currency: string;
  note: string;
  /** محجوزٌ بطلبٍ معلّق أو موافَق عليه */
  taken: boolean;
}

/** الموعد كما يراه صاحبه، ومعه من طلبه */
export interface MySlotRow extends SlotRow {
  isOpen: boolean;
  booking: { id: string; status: string; topic: string; participants: string } | null;
}

export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface BookingRow {
  id: string;
  slotId: string;
  startsAt: string;
  minutes: number;
  price: number | null;
  currency: string;
  topic: string;
  participants: string;
  status: BookingStatus;
  meetUrl: string;
  teacherNote: string;
  createdAt: string;
  /** جهة الطالب: المعلّم صاحب الموعد */
  teacherName?: string;
  teacherSlug?: string;
  /** رقم واتساب المعلّم — لا يُكشف إلا بعد الموافقة (`booking_whatsapp`) */
  whatsapp?: string;
}

/**
 * مواعيد معلّمٍ المتاحة — للزائر أيضاً.
 *
 * عبر `teacher_open_slots` لا بقراءةٍ مباشرة: القراءة المباشرة لا تعرف
 * أيّ موعدٍ محجوز (الحجوزات محجوبة عن غير صاحبها)، فيرى الطالب أزراراً
 * ترفض عند الضغط.
 */
export async function getTeacherSlots(teacherId: string): Promise<SlotRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("teacher_open_slots", { t_id: teacherId });
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      startsAt: String(r.starts_at),
      minutes: Number(r.minutes ?? 60),
      price: r.price === null || r.price === undefined ? null : Number(r.price),
      currency: String(r.currency ?? "ILS"),
      note: String(r.note ?? ""),
      taken: r.taken === true,
    }));
  } catch {
    return [];
  }
}

/** مواعيد المعلّم نفسه — القادمة منها، مفتوحةً كانت أو مغلقة */
export async function getMySlots(): Promise<MySlotRow[]> {
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

  // ساعةٌ للوراء: موعدٌ بدأ للتوّ ما زال يعني المعلّم
  const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [slotsRes, bookingsRes] = await Promise.all([
    supabase
      .from("availability_slots")
      .select("id, starts_at, minutes, price, currency, note, is_open")
      .eq("teacher_id", teacher.id)
      .gte("starts_at", from)
      .order("starts_at"),
    supabase
      .from("session_bookings")
      .select("id, slot_id, status, topic, participants")
      .eq("teacher_id", teacher.id)
      .in("status", ["pending", "approved"]),
  ]);

  const bySlot = new Map<string, Record<string, unknown>>();
  for (const b of (bookingsRes.data ?? []) as Record<string, unknown>[]) {
    bySlot.set(String(b.slot_id), b);
  }

  return ((slotsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const b = bySlot.get(String(r.id));
    return {
      id: String(r.id),
      startsAt: String(r.starts_at),
      minutes: Number(r.minutes ?? 60),
      price: r.price === null || r.price === undefined ? null : Number(r.price),
      currency: String(r.currency ?? "ILS"),
      note: String(r.note ?? ""),
      isOpen: r.is_open !== false,
      taken: Boolean(b),
      booking: b
        ? {
            id: String(b.id),
            status: String(b.status),
            topic: String(b.topic ?? ""),
            participants: String(b.participants ?? ""),
          }
        : null,
    };
  });
}

/**
 * طلبات الحجز الواردة إلى المعلّم.
 *
 * اسم الطالب يأتي من `participants` الذي كتبه هو، لا من `profiles`:
 * الحاجز قد لا يكون متابعاً لهذا المعلّم أصلاً، وسياسة قراءة ملفّات
 * المتابعين لا تشمله — فتوسيعها لأجل اسمٍ يكتبه الطالب بنفسه في الطلب
 * فتحُ بابٍ بلا مقابل.
 */
export async function getBookingRequests(): Promise<BookingRow[]> {
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
    .from("session_bookings")
    .select(
      "id, slot_id, topic, participants, status, meet_url, teacher_note, created_at, availability_slots (starts_at, minutes, price, currency)"
    )
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(80);

  return ((data ?? []) as Record<string, unknown>[]).map(mapBooking);
}

function mapBooking(r: Record<string, unknown>): BookingRow {
  const slot = (Array.isArray(r.availability_slots)
    ? r.availability_slots[0]
    : r.availability_slots) as Record<string, unknown> | null;
  return {
    id: String(r.id),
    slotId: String(r.slot_id),
    startsAt: String(slot?.starts_at ?? ""),
    minutes: Number(slot?.minutes ?? 60),
    price:
      slot?.price === null || slot?.price === undefined ? null : Number(slot.price),
    currency: String(slot?.currency ?? "ILS"),
    topic: String(r.topic ?? ""),
    participants: String(r.participants ?? ""),
    status: String(r.status ?? "pending") as BookingStatus,
    meetUrl: String(r.meet_url ?? ""),
    teacherNote: String(r.teacher_note ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

/**
 * حجوزات الطالب.
 *
 * رقم الواتساب يُطلب من `booking_whatsapp` لكل حجزٍ موافَقٍ عليه، لا
 * بقراءة عمود المعلّم: الدالّة هي عقد الكشف — بعد الموافقة ولصاحب الحجز
 * وحده — فقراءةٌ جانبية تجعل للواجهة قاعدةً غير قاعدة القاعدة.
 */
export async function getMyBookings(): Promise<BookingRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("session_bookings")
    .select(
      "id, slot_id, topic, participants, status, meet_url, teacher_note, created_at, availability_slots (starts_at, minutes, price, currency), teachers (name, slug)"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const t = (Array.isArray(r.teachers) ? r.teachers[0] : r.teachers) as Record<
      string,
      unknown
    > | null;
    return {
      ...mapBooking(r),
      teacherName: String(t?.name ?? ""),
      teacherSlug: String(t?.slug ?? ""),
    };
  });

  await Promise.all(
    rows.map(async (b) => {
      if (b.status !== "approved") return;
      const { data: wa } = await supabase.rpc("booking_whatsapp", { b_id: b.id });
      b.whatsapp = typeof wa === "string" ? wa : "";
    })
  );

  return rows;
}

/* ==================== مركز إشعارات المعلّم ==================== */

export interface NotifItem {
  key: string;
  icon: string;
  label: string;
  count: number;
  href: string;
}

/**
 * كل ما ينتظر قرار المعلّم، في مكانٍ واحد.
 *
 * كانت الطلبات موزّعةً على ستّ صفحات: الانضمام في «طلابي»، الحجز في
 * «المواعيد»، السؤال في «أسئلة الطلاب»… فمن لم يفتح الصفحة لم يعلم أن
 * أحداً ينتظره. والجرس يقلب المعادلة: العدد يأتي إليه لا هو يذهب إليه.
 *
 * كلّها عدّاداتٌ بـ`head: true` — لا تُنقل صفوف، فالجرس في التخطيط الجذري
 * ويُحسب في كل صفحة. **ويفشل مغلقاً**: خطأٌ هنا يعني جرساً فارغاً لا
 * صفحةً منهارة.
 */
export async function getTeacherNotifications(): Promise<NotifItem[]> {
  try {
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

    const t = teacher.id as string;
    const head = { count: "exact" as const, head: true };

    const [joins, bookings, cards, questions, messages, subs] = await Promise.all([
      // `follows` مفتاحها مركّب (طالب + معلّم) ولا عمود `id` فيها
      supabase
        .from("follows")
        .select("student_id", head)
        .eq("teacher_id", t)
        .eq("status", "pending"),
      supabase
        .from("session_bookings")
        .select("id", head)
        .eq("teacher_id", t)
        .eq("status", "pending"),
      supabase
        .from("report_card_requests")
        .select("id", head)
        .eq("teacher_id", t)
        .eq("status", "pending"),
      supabase
        .from("lesson_questions")
        .select("id", head)
        .eq("teacher_id", t)
        .is("answered_at", null),
      // الرسائل: «بانتظار ردّك» = آخر رسالة في الخيط من الطالب
      supabase
        .from("teacher_messages")
        .select("student_id, sender, created_at")
        .eq("teacher_id", t)
        .not("student_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("assignment_submissions")
        .select("id, assignments!inner(teacher_id)", head)
        .eq("assignments.teacher_id", t)
        .is("graded_at", null),
    ]);

    const lastSender = new Map<string, string>();
    for (const m of (messages.data ?? []) as Record<string, unknown>[]) {
      lastSender.set(String(m.student_id), String(m.sender));
    }
    const waiting = [...lastSender.values()].filter((s) => s === "student").length;

    const items: NotifItem[] = [
      {
        key: "joins",
        icon: "🙋",
        label: "طلب انضمام",
        count: joins.count ?? 0,
        href: "/teacher/me/students",
      },
      {
        key: "bookings",
        icon: "🗓",
        label: "طلب حجز موعد",
        count: bookings.count ?? 0,
        href: "/teacher/me/booking",
      },
      {
        key: "messages",
        icon: "✉️",
        label: "محادثة تنتظر ردّك",
        count: waiting,
        href: "/teacher/me/students",
      },
      {
        key: "questions",
        icon: "❓",
        label: "سؤال بلا إجابة",
        count: questions.count ?? 0,
        href: "/teacher/me/questions",
      },
      {
        key: "cards",
        icon: "🏅",
        label: "طلب بطاقة تقييم",
        count: cards.count ?? 0,
        href: "/teacher/me/students",
      },
      {
        key: "subs",
        icon: "📋",
        label: "تسليم بانتظار التصحيح",
        count: subs.count ?? 0,
        href: "/teacher/me/assignments",
      },
    ];

    return items.filter((i) => i.count > 0);
  } catch {
    return [];
  }
}
