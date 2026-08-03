import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import AdminCreditRow from "@/components/AdminCreditRow";
import { getCurrentUser, getAdminTeachers, isAdmin } from "@/lib/data/queries";
import { CREDIT_COST, TOOL_LABEL, type AiTool } from "@/lib/ai/credits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "لوحة الإدارة | منصة حصة",
  // لوحةٌ داخلية لا تُفهرَس، ولو كانت محميّةً على أي حال
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  /**
   * **غير الإداريّ لا يعرف أن الصفحة موجودة.**
   * إعادة توجيهٍ إلى الرئيسة، لا «ممنوع» — الرسالة نفسها تؤكّد للفضوليّ
   * أنه وجد شيئاً. والحماية الحقيقية في القاعدة على أيّ حال: دوالّ
   * الإدارة ترفض من ليس في `admins`.
   */
  if (!(await isAdmin())) redirect("/");

  let teachers;
  try {
    teachers = await getAdminTeachers();
  } catch {
    return <ConnectionNotice />;
  }

  const totalCredits = teachers.reduce((s, t) => s + t.credits, 0);
  const totalUsed = teachers.reduce((s, t) => s + t.usedCredits, 0);
  const tools = Object.keys(CREDIT_COST) as AiTool[];

  return (
    <main className="container">
      <PageHeader
        backHref="/"
        backLabel="الرئيسة"
        emoji="🛡️"
        title="لوحة الإدارة"
        subtitle={`${teachers.length} معلّماً · ${totalCredits} كريدت متاحاً · ${totalUsed} مستهلكاً`}
      />

      <Hint>
        الكريدت وحدةُ استهلاك أدوات الذكاء الاصطناعي. كل معلّم يبدأ برصيدٍ
        ابتدائيّ، ويُخصم منه ثمن كل أداة، ولا يستطيع تعديله بنفسه — الرصيد
        عمودٌ محجوبٌ عنه في القاعدة، ولا يغيّره إلا هذه اللوحة.
      </Hint>

      <section className="dashboard-section">
        <h2 className="section-title">💳 أثمان الأدوات</h2>
        <ul className="admin-prices">
          {tools.map((k) => (
            <li key={k}>
              <span>{TOOL_LABEL[k]}</span>
              <strong>{CREDIT_COST[k]}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">👩‍🏫 المعلّمون وأرصدتهم</h2>
        {teachers.length === 0 ? (
          <p className="drafts-empty">لا معلّمين بعد.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المعلّم</th>
                  <th>البريد</th>
                  <th>استهلك</th>
                  <th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <AdminCreditRow key={t.id} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
