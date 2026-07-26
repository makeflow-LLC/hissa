import type { Teacher } from "@/lib/teachers";
import { getAllLessons } from "@/lib/teachers";

export interface Student {
  id: string;
  name: string;
  subscribed: boolean;
  /** دروس أنجزها الطالب بترتيب المنهج (تقدّم متسلسل واقعي) */
  completedLessonIds: string[];
  joined: string;
  lastActive: string;
}

const STUDENT_NAMES = [
  "يوسف عادل",
  "ملك أيمن",
  "عمر خالد",
  "جنى محمود",
  "زياد طارق",
  "حبيبة سامح",
  "آدم شريف",
  "ليلى حاتم",
  "مازن وليد",
  "فريدة عمرو",
  "كريم صلاح",
  "سلمى نبيل",
  "حمزة إيهاب",
  "نادين عصام",
  "ياسين رامي",
  "لمى فؤاد",
  "أنس مجدي",
  "ريتاج هاني",
  "إياد سمير",
  "تالا وائل",
  "مروان فادي",
  "جودي ناصر",
  "طه رؤوف",
  "ميرال حسام",
] as const;

const JOINED_DATES = [
  "سبتمبر ٢٠٢٥",
  "أكتوبر ٢٠٢٥",
  "نوفمبر ٢٠٢٥",
  "يناير ٢٠٢٦",
  "مارس ٢٠٢٦",
  "مايو ٢٠٢٦",
] as const;

const LAST_ACTIVE = [
  "اليوم",
  "أمس",
  "منذ يومين",
  "منذ ٣ أيام",
  "منذ أسبوع",
  "منذ أسبوعين",
] as const;

/** hash بسيط حتمي حتى تبقى البيانات ثابتة بين الخادم والعميل */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * طلاب تجريبيون لكل معلم، مولّدون حتمياً من الـ slug:
 * نفس المعلم يعطي نفس القائمة دائماً (لا عشوائية بين تحميلات الصفحة).
 */
export function getStudentsForTeacher(teacher: Teacher): Student[] {
  const seed = hash(teacher.slug);
  const lessonIds = getAllLessons(teacher).map((e) => e.lesson.id);
  const count = 9 + (seed % 4); // ٩ إلى ١٢ طالباً

  return Array.from({ length: count }, (_, i) => {
    const s = seed + i * 17;
    const doneCount = s % (lessonIds.length + 1);
    return {
      id: `${teacher.slug}-student-${i + 1}`,
      name: STUDENT_NAMES[(seed + i * 5) % STUDENT_NAMES.length],
      subscribed: s % 4 !== 1, // نحو ٧٥٪ مشتركون
      completedLessonIds: lessonIds.slice(0, doneCount),
      joined: JOINED_DATES[s % JOINED_DATES.length],
      lastActive: LAST_ACTIVE[(s >> 2) % LAST_ACTIVE.length],
    };
  });
}
