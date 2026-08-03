import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import LessonDesigner from "@/components/LessonDesigner";
import {
  getCurrentUser,
  getMyTeacher,
  getMyTeacherContent,
} from "@/lib/data/queries";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

/**
 * استدعاء النموذج لتصميم درسٍ كامل أطول من تلخيصه — أقسامٌ وأهدافٌ وأسئلةٌ
 * ونشاط في ردٍّ واحد. ومهلة الدالّة الافتراضية على المستضيف أقصر من ذلك،
 * فتُقتل العملية قبل أن يُجيب النموذج ولا تستطيع أي معالجةٍ داخل التطبيق
 * أن تشرح ما جرى.
 */
export const maxDuration = 60;

export const metadata: Metadata = { title: "مصمّم الدروس | منصة حصة" };

export default async function LessonDesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/lessons/design");

  let content;
  let teacher;
  try {
    [content, teacher] = await Promise.all([getMyTeacherContent(), getMyTeacher()]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!content || !teacher) redirect("/teacher/onboarding");

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/content"
        backLabel="محتواي"
        emoji="✨"
        title="مصمّم الدروس"
        subtitle="اكتب الموضوع، وخُذ درساً كاملاً تراجعه وتحفظه حصّةً في منهجك."
      />

      <Hint>
        تكتب موضوع الدرس فقط، فيُبنى لك: أهداف تعلّم قابلة للقياس، ومصطلحات
        الدرس ومعانيها، وتمهيدٌ يفتح الحصّة، وشرحٌ مقسّم، وإعادةُ شرحٍ لمن لم
        يفهم وامتدادٌ لمن أتقن، وواجبٌ منزلي، وأسئلةُ فهم، ونشاطٌ تفاعليّ من
        محتوى الدرس نفسه. كلّه يصل إليك <strong>للمراجعة</strong>: تعدّل ما
        تشاء وتستبعد ما لا تريده، والدرس يُحفظ مسودّةً لا يراها طالب حتى
        تنشرها بنفسك.
      </Hint>

      <LessonDesigner
        units={content.units.map((u) => ({ id: u.id, title: u.title }))}
        aiOn={isAiConfigured()}
        subject={teacher.subject ?? ""}
      />
    </main>
  );
}
