import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import WorksheetControls from "@/components/WorksheetControls";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getWorksheetData } from "@/lib/data/queries";
import { sanitizeLessonHtml } from "@/lib/sanitize";
import { LEVEL_LABEL, type ReadingLevel } from "@/lib/ai/levels";
import type { ContentSection } from "@/lib/data/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ورقة عمل | منصة حصة",
  robots: { index: false, follow: false },
};

/** أ ب ج د — حروف الخيارات كما تُكتب في أوراق الامتحان العربية */
const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

function Sections({ sections, level }: { sections: ContentSection[]; level: string }) {
  return (
    <div className="ws-level" data-level={level}>
      {sections.map((s, i) => (
        <section key={i} className="ws-section">
          {s.heading && <h3 className="ws-heading">{s.heading}</h3>}
          {s.html ? (
            // مُعقَّمٌ عند العرض أيضاً — لا نثق بما هو مخزَّن مسبقاً
            <div
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(s.html) }}
            />
          ) : (
            (s.paragraphs ?? []).map((p, j) => <p key={j}>{p}</p>)
          )}
        </section>
      ))}
    </div>
  );
}

export default async function WorksheetPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/lessons/${lessonId}/worksheet`);

  let data;
  try {
    data = await getWorksheetData(lessonId);
  } catch {
    return <ConnectionNotice />;
  }
  // درسٌ ليس للمعلّم يعود `null` — لا يفتح شيئاً
  if (!data) notFound();

  const { lesson, teacherName, sections, levels, quiz } = data;
  const available: ReadingLevel[] = [
    ...(levels.some((l) => l.level === "simple") ? (["simple"] as const) : []),
    "standard",
    ...(levels.some((l) => l.level === "advanced") ? (["advanced"] as const) : []),
  ];

  return (
    <main className="container container-narrow worksheet-page">
      <div className="no-print">
        <PageHeader
          backHref={`/teacher/me/lessons/${lessonId}`}
          backLabel={lesson.title}
          emoji="🖨️"
          title="ورقة عمل"
          subtitle="من محتوى الدرس — بلا ذكاء اصطناعي وبلا كريدت."
        />
        <WorksheetControls levels={available} hasQuiz={quiz.length > 0} />
      </div>

      {/* ===== الورقة نفسها ===== */}
      <div className="worksheet">
        <header className="ws-head">
          <h1 className="ws-title">{lesson.title}</h1>
          <p className="ws-sub">
            {teacherName}
            {lesson.duration ? ` · ${lesson.duration}` : ""}
          </p>
          {/* خانتا الاسم والتاريخ: أول ما يبحث عنه المعلّم في أي ورقة */}
          <div className="ws-fields">
            <span>الاسم: ....................................</span>
            <span>الصف: ..................</span>
            <span>التاريخ: ..................</span>
          </div>
        </header>

        {lesson.description && <p className="ws-desc">{lesson.description}</p>}

        {/*
          المستويات الثلاثة تُطبع كلّها في الصفحة، ويُظهر CSS واحداً منها
          بحسب اختيار المعلّم — فلا يحتاج التبديل رحلةً إلى الخادم، وما
          يراه هو ما يُطبع بالضبط.
        */}
        <Sections sections={sections} level="standard" />
        {levels.map((l) => (
          <Sections key={l.level} sections={l.sections} level={l.level} />
        ))}

        {quiz.length > 0 && (
          <section className="ws-quiz">
            <h2 className="ws-h2">الأسئلة</h2>
            <ol className="ws-questions">
              {quiz.map((q) => (
                <li key={q.id}>
                  <p className="ws-q">{q.prompt}</p>
                  <ul className="ws-options">
                    {q.options.map((o, k) => (
                      <li key={k}>
                        <span className="ws-letter">{OPTION_LETTERS[k] ?? k + 1}</span>
                        {o}
                      </li>
                    ))}
                  </ul>
                  <span className="ws-lines" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </section>
        )}

        {quiz.length > 0 && (
          /* مفتاح الإجابة في صفحةٍ منفصلة دائماً — ورقةٌ تحمل مفتاحها في
             ظهرها لا تُوزَّع على الطلاب */
          <section className="ws-key">
            <h2 className="ws-h2">مفتاح الإجابة — {lesson.title}</h2>
            <ol className="ws-key-list">
              {quiz.map((q) => (
                <li key={q.id}>
                  {OPTION_LETTERS[q.correct_index] ?? q.correct_index + 1}){" "}
                  {q.options[q.correct_index] ?? ""}
                </li>
              ))}
            </ol>
            <p className="ws-foot">{teacherName}</p>
          </section>
        )}

        {available.length > 1 && (
          <p className="ws-note no-print">
            💡 هذه الورقة بالمستوى «{LEVEL_LABEL[available[0]]}» وما بعده —
            بدّل المستوى من الأعلى قبل الطباعة.
          </p>
        )}
      </div>
    </main>
  );
}
