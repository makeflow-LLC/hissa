import LiveNotifier from "@/components/LiveNotifier";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";

/**
 * يركّب مُنبِّه الإشعارات على **كل صفحة** لصاحب جلسة.
 *
 * كان مركّباً على لوحتَي الطالب والمعلّم وحدهما، فمن كان يحرّر درساً أو
 * يصحّح اختباراً أو يقرأ الدليل لم يصله شيء — وهو ما جعل رسالة الطالب
 * تمرّ دون تنبيه. الإشعار لا معنى له إن لزم الوقوفَ على صفحة بعينها.
 *
 * يفشل مغلقاً كبقية ما يُقرأ في الجذر: أي خطأ ⇒ لا مُنبِّه، لا صفحةٌ
 * معطوبة.
 */
export default async function LiveNotifierMount() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const teacher = await getMyTeacher();
    return teacher ? (
      <LiveNotifier role="teacher" userId={user.id} teacherId={teacher.id} />
    ) : (
      <LiveNotifier role="student" userId={user.id} />
    );
  } catch {
    return null;
  }
}
