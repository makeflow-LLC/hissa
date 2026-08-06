import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import QuestionInbox from "@/components/QuestionInbox";
import { getCurrentUser, getMyTeacher, getQuestionInbox } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "أسئلة الطلاب | منصة حصة" };

export default async function QuestionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/questions");
  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let questions;
  try {
    questions = await getQuestionInbox();
  } catch {
    return <ConnectionNotice />;
  }
  const waiting = questions.filter((q) => !q.answeredAt).length;

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="❓"
        title="أسئلة الطلاب"
        subtitle={
          waiting > 0
            ? `${waiting} سؤالاً بانتظار جوابك`
            : "لا أسئلة معلّقة — أحسنت."
        }
      />
      <Hint>
        السؤال هنا يُجاب <strong>مرّةً واحدة</strong>: جوابك يظهر تحت الدرس
        لكل من يفتحه بعدك، بدل أن تعيده لكل طالب في رسالة خاصّة. وغير
        المُجاب يتصدّر القائمة، والأكثر تصويتاً («عندي نفس السؤال») قبله —
        فإجابته تنفع عدداً أكبر دفعةً واحدة.
      </Hint>
      <QuestionInbox questions={questions} />
    </main>
  );
}
