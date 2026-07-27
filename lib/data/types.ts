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
  rating: number;
  rating_count: number;
  qualification: string;
  experience_years: number;
}

/** ملف المعلّم الحالي (المسجّل بحسابه) — لصفحات إدارة بروفايله */
export interface MyTeacher extends TeacherRow {
  is_published: boolean;
}

/** بطاقة المعلم في الدليل: بيانات المعلم + عدّادات محتواه */
export interface TeacherCard extends TeacherRow {
  lessonCount: number;
  liveCount: number;
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

export interface LiveSessionRow {
  id: string;
  title: string;
  description: string;
  schedule: string;
  duration: string;
  seats_left: number;
  emoji: string;
  gradient: string;
  is_paid: boolean;
  price: number;
  currency: string;
}

export interface AttachmentRow {
  id: string;
  name: string;
  kind: "pdf" | "worksheet";
  size: string;
  file_path: string;
}

export interface QuizQuestionRow {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
}

/** بروفايل معلم كامل مع منهجه وحصصه */
export interface TeacherProfile {
  teacher: TeacherRow;
  units: UnitWithLessons[];
  liveSessions: LiveSessionRow[];
  /** حالة الطالب الحالي تجاه هذا المعلم (فارغة للزائر) */
  isFollowing: boolean;
  completedLessonIds: string[];
  enrolledSessionIds: Record<string, string>;
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
}

/** رسالة من معلّم إلى طالب بعينه أو إلى كل متابعيه */
export interface TeacherMessage {
  id: string;
  teacher_id: string;
  student_id: string | null;
  body: string;
  created_at: string;
}
