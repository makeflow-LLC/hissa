import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ActivityDemo from "@/components/ActivityDemo";
import { KINDS } from "@/lib/activityKinds";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "كيف تُنشئ نشاطاً تفاعلياً | منصة حصة" };

const STEPS: { t: string; d: React.ReactNode }[] = [
  {
    t: "اكتب الأزواج مرّة واحدة",
    d: (
      <>
        كل صفٍّ طرفان: كلمة ومعناها، سؤال وجوابه، عنصر وفئته. هذا هو محتوى
        النشاط كلّه — <strong>ولن تعيد كتابته أبداً</strong> مهما بدّلت اللعبة.
      </>
    ),
  },
  {
    t: "اختر اللعبة",
    d: (
      <>
        النوع يقرّر كيف يُعرض الطرفان لا ما هما. جرّب المعرض في الأسفل: اضغط
        نوعاً والعبه بمحتوى جاهز قبل أن تختاره لطلابك.
      </>
    ),
  },
  {
    t: "حدّد من يلعبه",
    d: (
      <>
        اتركه لجميع طلابك المنضمّين، أو صوّبه إلى مجموعة واحدة. وإن ربطته بدرس
        ظهر لطلابك في مكانه من المنهج.
      </>
    ),
  },
  {
    t: "العبه بنفسك",
    d: (
      <>
        صفحة النشاط تعرض «جرّبها كما يراها طالبك». اللعب دقيقة واحدة يكشف الصفّ
        الناقص أو الكلمة الملتبسة أسرع من مراجعة الجدول عشر مرّات.
      </>
    ),
  },
  {
    t: "انشره",
    d: (
      <>
        المسودّة لا يراها أحد. بالنشر يظهر النشاط في لوحات طلابك فوراً، ويمكنك
        إعادته مسودّةً في أي وقت.
      </>
    ),
  },
  {
    t: "تابع من لعبه",
    d: (
      <>
        صفحة النشاط تُظهر من لعب وكم أصاب وكم استغرق، ولوحة صدارة اختيارية
        لأفضل النتائج. النتيجة تشجيعٌ لا تقييم — لا تدخل في علامات طالبك.
      </>
    ),
  },
];

const TIPS: { q: string; a: React.ReactNode }[] = [
  {
    q: "أي لعبة أختار؟",
    a: (
      <>
        للحفظ والمراجعة الهادئة: <strong>بطاقات تعليمية</strong> أو{" "}
        <strong>ذاكرة البطاقات</strong>. لتثبيت مصطلح ومعناه:{" "}
        <strong>مطابقة</strong>. لمراجعة سريعة قبل الاختبار:{" "}
        <strong>اختيار سريع</strong> أو <strong>صح أو خطأ</strong>. للحماس
        والتنافس: <strong>فرقعة البالونات</strong> و<strong>تحدّي السرعة</strong>.
        للإملاء والمفردات: <strong>رتّب الحروف</strong>. لتنظيم المفاهيم في
        فئات: <strong>صنّف في مجموعات</strong>. وأمام الصفّ لاختيار طالب أو
        سؤال: <strong>عجلة عشوائية</strong>.
      </>
    ),
  },
  {
    q: "لماذا لا أكتب الخيارات الخاطئة؟",
    a: (
      <>
        في «اختيار سريع» و«البالونات» و«تحدّي السرعة» تُبنى الخيارات الخاطئة من
        إجابات بقيّة صفوفك. فاكتب سؤالاً وجوابه الصحيح فقط — وكلّما زادت
        الصفوف تنوّعت الخيارات وصعُبت اللعبة.
      </>
    ),
  },
  {
    q: "كم صفّاً أكتب؟",
    a: (
      <>
        ستّة إلى عشرة صفوف عادةً كافية: أقلّ من ذلك تُحفظ اللعبة عن ظهر قلب،
        وأكثر منها يُملّ الطالب قبل النهاية. «ذاكرة البطاقات» وحدها لها سقف
        ثمانية أزواج لأنها تعرض ضِعف العدد بطاقاتٍ على الشاشة.
      </>
    ),
  },
  {
    q: "هل النتيجة علامة رسمية؟",
    a: (
      <>
        لا، وعمداً. النشاط تدريب، وإجاباته تصل متصفّح الطالب بطبيعتها — لا
        يمكن لعب المطابقة دون رؤية الطرفين. فالنتيجة تشجيع تُعرض له ولك ولا
        تدخل أي معدّل. ما تريد له علامة محميّة مكانه{" "}
        <Link href="/teacher/me/exams">الاختبارات</Link>.
      </>
    ),
  },
  {
    q: "هل أبدأ من الصفر كل مرّة؟",
    a: (
      <>
        لا. عندك قوالب جاهزة من المنصة (هيكل ونوع وصفوف فارغة)، ويمكنك حفظ
        قالبك أنت لتعيد استخدامه، أو <strong>استنساخ</strong> نشاط سابق
        وتعديله — والنسخة تنزل مسودّةً دائماً حتى تراجعها.
      </>
    ),
  },
  {
    q: "أريد نفس المحتوى بلعبة أخرى",
    a: (
      <>
        بدّل النوع من قائمة النشاط واحفظ — الصفوف كما هي. أو استنسخ النشاط
        وبدّل نوع النسخة، فيصير عندك نشاطان بمحتوى واحد ولعبتين.
      </>
    ),
  },
];

export default async function ActivityGuidePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/activities/guide");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/teacher/me/activities"
        backLabel="الأنشطة"
        emoji="📘"
        title="كيف تُنشئ نشاطاً تفاعلياً"
        subtitle="ستّ خطوات، ومعرضٌ تلعب فيه كل نوع بنفسك قبل أن تختاره."
        actions={
          <Link href="/teacher/me/activities/new" className="btn btn-primary">
            ➕ ابدأ نشاطاً الآن
          </Link>
        }
      />

      <section className="dashboard-section">
        <h2 className="section-title">🧭 الخطوات</h2>
        <ol className="guide-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="guide-step">
              <span className="guide-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="guide-step-title">{s.t}</h3>
                <p className="guide-step-text">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">🎮 جرّب الألعاب ({KINDS.length} أنواع)</h2>
        <p className="form-hint">
          اضغط أي نوع فتُفتح لعبته بمحتوى تجريبيّ — لا يُحفظ ولا يُنشر، ولا
          تُسجَّل فيه نتيجة.
        </p>
        <ActivityDemo />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">💡 أسئلة يسألها كل معلّم</h2>
        <ul className="help-list">
          {TIPS.map((t) => (
            <li key={t.q} className="help-item">
              <details>
                <summary className="help-q">{t.q}</summary>
                {/* `.help-a` شبكة، فكل نصٍّ عارٍ فيها يصير خليّةً مستقلّة
                    وتتفكّك الفقرة إلى أسطر. الفقرة الواحدة تُبقيها جملةً */}
                <div className="help-a">
                  <p>{t.a}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <p className="content-foot-hint">
        <Link href="/teacher/me/activities" className="back-link">
          ← رجوع إلى الأنشطة
        </Link>
      </p>
    </main>
  );
}
