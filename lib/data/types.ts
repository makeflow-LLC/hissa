import type { ActivityItem, ActivityKind } from "@/lib/activityKinds";

/** أنواع صفوف قاعدة البيانات كما تعيدها Supabase */

export type Stage = "ابتدائي" | "إعدادي" | "ثانوي";

export interface ContentSection {
  heading: string;
  /** محتوى منسّق من محرّر المعلّم — يُعقَّم قبل العرض */
  html?: string;
  /** الصيغة القديمة (فقرات نصية) — لا تزال تُعرض لدروس أُنشئت قبل المحرّر */
  paragraphs?: string[];
}

export interface GalleryItem {
  id?: string;
  emoji: string;
  caption: string;
  gradient: string;
}

export interface TeacherRow {
  id: string;
  slug: string;
  name: string;
  subject: string;
  stages: string[];
  bio: string;
  initials: string;
  gradient: string;
  avatar_url: string | null;
  whatsapp: string | null;
  /** رقم هاتفٍ للاتصال — منفصلٌ عن الواتساب، وكلاهما اختياريّ */
  phone: string | null;
  /**
   * هل يُعرض رقما التواصل في صندوق الحجز؟ مفتاحٌ يملكه المعلّم.
   * والواجهة تشترط فوقه **دخول المستخدم**: الكاشط لا يسجّل بحساب جوجل.
   */
  contact_public: boolean;
  rating: number;
  rating_count: number;
  qualification: string;
  experience_years: number;
  /** شروط الانضمام التي يكتبها المعلّم، تُعرض للطالب قبل إرسال طلبه */
  join_instructions: string;
  /** حالة توفّر المعلّم للردّ — يضبطها بنفسه */
  availability: Availability;
  availability_note: string;
}

/** متاح للردّ · مشغول الآن · خارج الخدمة */
export type Availability = "available" | "busy" | "offline";

/** ملف المعلّم الحالي (المسجّل بحسابه) — لصفحات إدارة بروفايله */
export interface MyTeacher extends TeacherRow {
  is_published: boolean;
}

/** بطاقة المعلم في الدليل: بيانات المعلم + عدّادات محتواه */
export interface TeacherCard extends TeacherRow {
  lessonCount: number;
  studentCount: number;
  unitCount: number;
  /** نص مجمّع للبحث: الاسم والمادة والنبذة والمؤهل وعناوين الدروس */
  searchText: string;
}

/** بيانات الدرس الوصفية — متاحة للزائر والطالب على حد سواء */
export interface LessonMeta {
  id: string;
  unit_id: string | null;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  gradient: string;
  position: number;
  is_free_preview: boolean;
}

/** محتوى الدرس الكامل — للطالب المسجّل، أو للزائر في العيّنة المجانية فقط */
export interface LessonContent {
  sections: ContentSection[];
  gallery: GalleryItem[];
  video_url: string | null;
}

export interface UnitWithLessons {
  id: string;
  title: string;
  description: string;
  position: number;
  lessons: LessonMeta[];
}


export interface AttachmentRow {
  id: string;
  name: string;
  kind: string;
  size: string;
  file_path: string;
}

export interface QuizQuestionRow {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
}

/**
 * حالة الطالب تجاه معلّم.
 *
 * المتابعة والانضمام مستويان لا خياران متنافيان:
 * none      = لا يتابع ولا انضمّ
 * following = يتابع فقط — إشارة اهتمام لا تمنح صلاحية
 * pending   = طلب الانضمام وينتظر قرار المعلّم
 * approved  = منضمّ إلى الصف فعلاً
 * rejected  = لم يُقبل طلبه (ويظلّ متابعاً)
 */
export type FollowStatus =
  | "none"
  | "following"
  | "pending"
  | "approved"
  | "rejected";

/** بروفايل معلم كامل مع منهجه وحصصه */
export interface TeacherProfile {
  teacher: TeacherRow;
  units: UnitWithLessons[];
  /** حالة الطالب الحالي تجاه هذا المعلم (none للزائر) */
  followStatus: FollowStatus;
  /** سبب الرفض إن كتبه المعلّم */
  followDecisionNote: string;
  /**
   * معلّم آخر يتابعه الطالب في نفس المادة — يمنع الانضمام هنا.
   * فارغ إن لم يوجد تعارض.
   */
  subjectClashTeacher: string;
  /**
   * الطالب عضو في إحدى مجموعات هذا المعلّم.
   * رقم واتساب المعلّم لا يُعرض إلا لهؤلاء — نشره للعموم يحوّل صفحته
   * إلى مصدر أرقام لأي زائر أو روبوت.
   */
  inTeacherGroup: boolean;
  /** يتابع المعلّم (بأي حالة) */
  isFollowing: boolean;
  completedLessonIds: string[];
  /** تقييم الطالب الحالي لهذا المعلّم إن كتبه */
  myReview: { rating: number; comment: string } | null;
  reviews: PublicReview[];
}

/** صفحة درس واحد بسياقه في المنهج */
export interface LessonPage {
  teacher: TeacherRow;
  unit: { id: string; title: string } | null;
  lesson: LessonMeta;
  /** null عندما يكون الدرس مقفلاً على الزائر */
  content: LessonContent | null;
  attachments: AttachmentRow[];
  quiz: QuizQuestionRow[];
  unitLessons: LessonMeta[];
  index: number;
  total: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  isCompleted: boolean;
  locked: boolean;
  /** محاولة الطالب السابقة في اختبار هذا الدرس */
  quizAttempt: { score: number; total: number } | null;
}

/** تقييم منشور على صفحة المعلّم */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  studentName: string;
}

/** تقرير المعلّم لوليّ أمر الطالب */
export interface ParentReport {
  id: string;
  student_id: string;
  period: string;
  performance: string;
  strengths: string;
  improvements: string;
  note: string;
  created_at: string;
}

/** بيانات الطالب في profiles (يملؤها الطالب بنفسه) */
export interface StudentProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  grade: string;
  school: string;
  city: string;
  age: number | null;
  phone: string | null;
  whatsapp: string | null;
  guardian_phone: string | null;
  profile_done: boolean;
}

/** صف واحد في قائمة طلاب المعلّم مع تقدّمه في منهج هذا المعلّم */
export interface TeacherStudent {
  profile: StudentProfile;
  followedAt: string;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  /** منح الوصول التي أعطاها هذا المعلّم لهذا الطالب */
  grants: { id: string; lesson_id: string | null; session_id: string | null }[];
  /** المجموعات التي وُضع فيها عند هذا المعلّم */
  groupIds: string[];
}

/** طلب انضمام ينتظر بتّ المعلّم */
export interface JoinRequest {
  studentId: string;
  name: string;
  grade: string;
  school: string;
  city: string;
  avatarUrl: string | null;
  requestedAt: string;
}

/** مجموعة طلاب ينشئها المعلّم */
export interface StudentGroup {
  id: string;
  name: string;
  description: string;
  position: number;
  memberCount: number;
  /** رابط دعوة مجموعة واتساب — لأعضاء المجموعة وحدهم */
  whatsapp_link: string;
  /** هدف الصفّ هذا الفصل */
  goal: string;
  /** موعد اللقاء كما يكتبه المعلّم نصّاً */
  schedule: string;
}

/** عضو في مجموعة كما يظهر على لوحة المجموعة */
export interface GroupMember {
  studentId: string;
  name: string;
  grade: string;
  avatarUrl: string | null;
  /** تقدّمه في منهج هذا المعلّم */
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  /** متوسّط اختبارات هذه المجموعة (null إن لم يقدّم شيئاً) */
  examAvg: number | null;
  examsTaken: number;
  /** آخر بطاقة تقييم صدرت له */
  lastCardTitle: string | null;
  /** رسائل منه لم يُردّ عليها بعد */
  awaitingReply: boolean;
}

/** كل ما تعرضه صفحة المجموعة */
export interface GroupHub {
  group: StudentGroup;
  members: GroupMember[];
  /** طلاب منضمّون خارج هذه المجموعة — لإضافتهم */
  candidates: { studentId: string; name: string; grade: string }[];
  /** تعاميم أُرسلت إلى هذه المجموعة */
  announcements: { id: string; body: string; created_at: string }[];
  /** اختبارات موجّهة إلى هذه المجموعة */
  exams: {
    id: string;
    title: string;
    status: "draft" | "published";
    submittedCount: number;
    needsGrading: number;
  }[];
  /** دروس المعلّم المعلَّمة «خاصة» — لمنحها للمجموعة دفعةً واحدة */
  restrictedLessons: { id: string; title: string; grantedCount: number }[];
  totalLessons: number;
}

/** بطاقة تقييم تصدر في نهاية وحدة أو فصل */
export interface ReportCard {
  id: string;
  teacher_id: string;
  student_id: string;
  unit_id: string | null;
  term: string;
  title: string;
  understanding: number | null;
  participation: number | null;
  homework: number | null;
  behavior: number | null;
  score: number | null;
  max_score: number | null;
  strengths: string;
  improvements: string;
  note: string;
  issued_at: string;
}

/** طلب طالب لبطاقة تقييم */
export interface CardRequest {
  id: string;
  studentId: string;
  studentName: string;
  createdAt: string;
}

/** طلب بطاقة كما يراه الطالب على لوحته */
export interface MyCardRequest {
  id: string;
  teacherName: string;
  status: "pending" | "done" | "declined";
  createdAt: string;
}

/** رسالة من معلّم إلى طالب بعينه أو إلى كل متابعيه */
export interface TeacherMessage {
  id: string;
  teacher_id: string;
  student_id: string | null;
  /** مضبوط = تعميم لهذه المجموعة وحدها */
  group_id: string | null;
  body: string;
  created_at: string;
  /** من كتبها — الخيط الواحد يحمل رسائل الطرفين */
  sender: "teacher" | "student";
}

/* ==================== الاختبارات ==================== */

export type QuestionKind = "mcq" | "truefalse" | "text";

/** سؤال كما يراه المعلّم — بإجابته الصحيحة */
export interface ExamQuestion {
  id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_index: number | null;
  correct_bool: boolean | null;
  model_answer: string;
  points: number;
}

/** سؤال كما يراه الطالب — بلا إجابة صحيحة (من get_exam_paper) */
export interface ExamPaperQuestion {
  id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  points: number;
}

export interface Exam {
  id: string;
  teacher_id: string;
  group_id: string;
  title: string;
  description: string;
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number | null;
  /** العلامة الكلّية التي يقصدها المعلّم — للمقارنة والتنبيه لا للتصحيح */
  target_points: number | null;
  status: "draft" | "published";
  created_at: string;
}

/** اختبار في قائمة المعلّم مع عدّاداته */
export interface ExamSummary extends Exam {
  groupName: string;
  questionCount: number;
  totalPoints: number;
  submittedCount: number;
  needsGrading: number;
}

/** اختبار كما يظهر للطالب على لوحته */
export interface StudentExam {
  id: string;
  title: string;
  description: string;
  teacherName: string;
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number | null;
  questionCount: number;
  totalPoints: number;
  /** حالة محاولته إن بدأها */
  attempt: {
    id: string;
    status: "in_progress" | "submitted" | "graded";
    auto_score: number;
    manual_score: number;
    max_score: number;
  } | null;
}

export interface ExamAnswer {
  id: string;
  question_id: string;
  choice_index: number | null;
  bool_answer: boolean | null;
  text_answer: string;
  awarded: number;
  graded: boolean;
}

/** محاولة طالب كما يراها المعلّم عند التصحيح */
export interface AttemptForGrading {
  id: string;
  studentId: string;
  studentName: string;
  status: "in_progress" | "submitted" | "graded";
  submitted_at: string | null;
  auto_score: number;
  manual_score: number;
  max_score: number;
  answers: ExamAnswer[];
}

/* ==================== الأنشطة التفاعلية ==================== */

/** نشاط كما يملكه المعلّم */
export interface Activity {
  id: string;
  teacher_id: string;
  group_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string;
  kind: ActivityKind;
  items: ActivityItem[];
  /** صورة النشاط الواحدة — تستعملها «سمِّ الأجزاء» */
  image_url: string;
  /** يرى الطلاب ترتيب أفضل النتائج؟ يقرّره المعلّم */
  show_leaderboard: boolean;
  status: "draft" | "published";
  created_at: string;
}

/** نشاط في قائمة المعلّم مع عدّاداته */
export interface ActivitySummary extends Activity {
  /** اسم المجموعة، أو «كل طلابي» */
  audience: string;
  playCount: number;
  playerCount: number;
}

/** نشاط كما يظهر للطالب */
export interface StudentActivity {
  id: string;
  title: string;
  instructions: string;
  kind: ActivityKind;
  items: ActivityItem[];
  imageUrl: string;
  teacherName: string;
  showLeaderboard: boolean;
  /** أفضل نتيجة سجّلها الطالب (null إن لم يلعب أو كانت اللعبة بلا درجة) */
  bestScore: number | null;
  bestTotal: number | null;
  plays: number;
}

/** لعبة طالب كما يراها المعلّم */
export interface ActivityPlayRow {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  total: number;
  seconds: number;
  played_at: string;
}
