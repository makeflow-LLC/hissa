"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InfoTip from "@/components/InfoTip";
import {
  designLesson,
  saveDesignedLesson,
  type DesignState,
  type SaveDesignState,
} from "@/app/actions/lesson-design";
import { EMPTY_PLAN, planHasContent, type LessonPlan } from "@/lib/ai/lessonPlan";
import { kindSpec } from "@/lib/activityKinds";

const initial: DesignState = { ok: false };
const initialSave: SaveDesignState = { ok: false };

/**
 * مصمّم الدرس: يكتب المعلّم الموضوع، فيُبنى درسٌ كامل — أهدافاً ومفرداتٍ
 * وتمهيداً وشرحاً وأسئلةً ونشاطاً — ثم **يراجعه ويحذف منه ويحفظه حصّة**.
 *
 * وشرطان يحكمان التصميم كلّه:
 *
 * - **النموذج يقترح ولا ينشر.** كل ما يعود يهبط هنا للمراجعة، والدرس
 *   يُحفظ مسودّةً دائماً. معلومةٌ خاطئة تُنشر باسم المعلّم تضرّه هو.
 * - **لا شيء يُحفظ إلا ما أبقاه المعلّم.** كل كتلة لها مفتاح إبقاء، وكل
 *   حقلٍ نصّيٍّ قابل للتحرير هنا قبل الحفظ — فالمراجعة ليست قراءةً فقط.
 */
export default function LessonDesigner({
  units,
  aiOn,
  subject,
}: {
  units: { id: string; title: string }[];
  aiOn: boolean;
  subject: string;
}) {
  const router = useRouter();
  const [state, generate, generating] = useActionState(designLesson, initial);
  const [saveState, save, saving] = useActionState(saveDesignedLesson, initialSave);

  const [plan, setPlan] = useState<LessonPlan>(EMPTY_PLAN);

  // الخطّة تصل من الخادم فتصير حالةً قابلة للتحرير — في تأثيرٍ لا في العرض
  useEffect(() => {
    if (state.ok && state.plan) setPlan(state.plan);
  }, [state]);

  useEffect(() => {
    if (saveState.ok && saveState.lessonId)
      router.push(`/teacher/me/lessons/${saveState.lessonId}`);
  }, [saveState, router]);

  const ready = planHasContent(plan);

  function patch(next: Partial<LessonPlan>) {
    setPlan((p) => ({ ...p, ...next }));
  }

  if (!aiOn) {
    return (
      <p className="drafts-empty">
        مصمّم الدروس يحتاج تفعيل الذكاء الاصطناعي على الخادم. تواصل مع مشرف
        المنصّة.
      </p>
    );
  }

  return (
    <div className="lesson-designer">
      {/* ===== ١) ما الذي نصمّمه؟ ===== */}
      <form action={generate} className="exam-form designer-brief">
        <h2 className="section-title">١. ما الدرس الذي تريده؟</h2>

        <label className="form-field">
          <span className="form-label">موضوع الدرس *</span>
          <input
            type="text"
            name="topic"
            className="search-input"
            placeholder={`مثال: ${exampleFor(subject)}`}
            maxLength={300}
            required
          />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">الصفّ (اختياري)</span>
            <input
              type="text"
              name="grade"
              className="search-input"
              placeholder="مثال: الصف السابع"
              maxLength={80}
            />
          </label>

          <label className="form-field">
            <span className="form-label">مدّة الحصّة</span>
            <select name="minutes" defaultValue="45">
              <option value="20">٢٠ دقيقة</option>
              <option value="30">٣٠ دقيقة</option>
              <option value="45">٤٥ دقيقة</option>
              <option value="60">٦٠ دقيقة</option>
              <option value="90">٩٠ دقيقة</option>
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">عدد أقسام الشرح</span>
            <select name="sections" defaultValue="4">
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} أقسام
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">أسئلة الفهم</span>
            <select name="questions" defaultValue="5">
              <option value="0">بلا أسئلة</option>
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} أسئلة
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">
            📚 مادّة مرجعية (اختيارية)
            <InfoTip>
              الصِق هنا فقرةً من كتاب المنهج، أو التعريفات والأمثلة التي
              تريد الدرس مبنياً عليها. يلتزم بها النموذج ولا يخالفها، ويكمل
              ما لم يرد فيها بما يناسب المرحلة. اتركها فارغة ليبني من معرفته.
            </InfoTip>
          </span>
          <textarea
            name="references"
            rows={4}
            placeholder="الصِق نصّ الدرس من الكتاب المقرّر، أو التعريفات والقوانين التي تريد الالتزام بها…"
            maxLength={6000}
          />
        </label>

        <label className="form-field">
          <span className="form-label">
            توصياتك
            <InfoTip>
              ما تكتبه هنا يلتزم به النموذج: «ركّز على الأمثلة المحلولة»،
              «تجنّب الرموز»، «اربطه بدرس الأسبوع الماضي».
            </InfoTip>
          </span>
          <textarea
            name="notes"
            rows={2}
            placeholder="مثال: أكثِر من الأمثلة المحسوسة وتجنّب المصطلحات الأجنبية"
            maxLength={600}
          />
        </label>

        <div className="card-actions">
          <button type="submit" className="btn btn-primary" disabled={generating}>
            {generating ? "…يصمّم الدرس (قد يستغرق نصف دقيقة)" : "✨ صمّم الدرس"}
          </button>
          {typeof state.remaining === "number" && (
            <span className="form-hint">بقي لك {state.remaining} توليدة هذا الشهر</span>
          )}
        </div>

        {state.message && <p className="form-error">{state.message}</p>}
        {generating && (
          <p className="form-hint">
            يكتب النموذج الأهداف والمفردات والشرح والأسئلة والنشاط في طلبٍ
            واحد — لا تُغلق الصفحة.
          </p>
        )}
      </form>

      {/* ===== ٢) المراجعة والحفظ ===== */}
      {ready && (
        <form action={save} className="exam-form designer-review">
          <h2 className="section-title">٢. راجِع وعدّل قبل الحفظ</h2>
          <input type="hidden" name="plan" value={JSON.stringify(plan)} />

          <div className="form-row">
            <label className="form-field">
              <span className="form-label">عنوان الدرس *</span>
              <input
                type="text"
                className="search-input"
                value={plan.title}
                maxLength={150}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-label">المدّة</span>
              <input
                type="text"
                className="search-input"
                value={plan.duration}
                maxLength={40}
                onChange={(e) => patch({ duration: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-label">الرمز</span>
              <input
                type="text"
                className="search-input"
                value={plan.emoji}
                maxLength={4}
                onChange={(e) => patch({ emoji: e.target.value })}
              />
            </label>
          </div>

          <label className="form-field">
            <span className="form-label">الوصف — يقرؤه الطالب في القائمة</span>
            <input
              type="text"
              className="search-input"
              value={plan.description}
              maxLength={300}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>

          {/* ----- الأهداف ----- */}
          <Block
            name="withObjectives"
            title="🎯 أهداف الدرس"
            count={plan.objectives.length}
          >
            {plan.objectives.map((o, i) => (
              <div key={i} className="designer-line">
                <input
                  type="text"
                  className="search-input"
                  value={o}
                  maxLength={300}
                  aria-label={`الهدف ${i + 1}`}
                  onChange={(e) =>
                    patch({
                      objectives: plan.objectives.map((x, j) =>
                        j === i ? e.target.value : x
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  aria-label={`حذف الهدف ${i + 1}`}
                  onClick={() =>
                    patch({ objectives: plan.objectives.filter((_, j) => j !== i) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </Block>

          {/* ----- المصطلحات ----- */}
          <Block
            name="withVocabulary"
            title="📖 المصطلحات"
            count={plan.vocabulary.length}
          >
            {plan.vocabulary.map((v, i) => (
              <div key={i} className="designer-line">
                <input
                  type="text"
                  className="search-input designer-term"
                  value={v.term}
                  maxLength={120}
                  aria-label={`المصطلح ${i + 1}`}
                  onChange={(e) =>
                    patch({
                      vocabulary: plan.vocabulary.map((x, j) =>
                        j === i ? { ...x, term: e.target.value } : x
                      ),
                    })
                  }
                />
                <input
                  type="text"
                  className="search-input"
                  value={v.meaning}
                  maxLength={400}
                  aria-label={`معنى المصطلح ${i + 1}`}
                  onChange={(e) =>
                    patch({
                      vocabulary: plan.vocabulary.map((x, j) =>
                        j === i ? { ...x, meaning: e.target.value } : x
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  aria-label={`حذف المصطلح ${i + 1}`}
                  onClick={() =>
                    patch({ vocabulary: plan.vocabulary.filter((_, j) => j !== i) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </Block>

          {/* ----- التمهيد ----- */}
          {plan.starter && (
            <Block name="withStarter" title="🚀 التمهيد">
              <Preview html={plan.starter} />
            </Block>
          )}

          {/* ----- أقسام الشرح ----- */}
          <div className="designer-block">
            <div className="section-head-row">
              <strong className="form-label">
                📚 الشرح — {plan.sections.length} أقسام
              </strong>
            </div>
            <p className="form-hint">
              الشرح يُحفظ كاملاً. لتحريره بالتفصيل — تلويناً وجداول وصوراً —
              افتح الدرس في محرّره بعد الحفظ.
            </p>
            {plan.sections.map((s, i) => (
              <details key={i} className="designer-section">
                <summary>
                  <input
                    type="text"
                    className="search-input"
                    value={s.heading}
                    maxLength={200}
                    aria-label={`عنوان القسم ${i + 1}`}
                    onClick={(e) => e.preventDefault()}
                    onChange={(e) =>
                      patch({
                        sections: plan.sections.map((x, j) =>
                          j === i ? { ...x, heading: e.target.value } : x
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-danger"
                    aria-label={`حذف القسم ${i + 1}`}
                    onClick={() =>
                      patch({ sections: plan.sections.filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </button>
                </summary>
                <Preview html={s.html} />
              </details>
            ))}
          </div>

          {/* ----- الدعم والإثراء ----- */}
          {(plan.scaffold || plan.stretch) && (
            <Block name="withSupport" title="🪜 دعم المتعثّر وإثراء المتقن">
              {plan.scaffold && <Preview html={plan.scaffold} />}
              {plan.stretch && <Preview html={plan.stretch} />}
            </Block>
          )}

          {/* ----- الواجب ----- */}
          {plan.homework && (
            <Block name="withHomework" title="📝 الواجب">
              <Preview html={plan.homework} />
            </Block>
          )}

          {/* ----- الأسئلة ----- */}
          {plan.quiz.length > 0 && (
            <Block name="withQuiz" title="❓ أسئلة الفهم" count={plan.quiz.length}>
              <ol className="designer-quiz">
                {plan.quiz.map((q, i) => (
                  <li key={i}>
                    <div className="designer-line">
                      <input
                        type="text"
                        className="search-input"
                        value={q.prompt}
                        maxLength={400}
                        aria-label={`السؤال ${i + 1}`}
                        onChange={(e) =>
                          patch({
                            quiz: plan.quiz.map((x, j) =>
                              j === i ? { ...x, prompt: e.target.value } : x
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-danger"
                        aria-label={`حذف السؤال ${i + 1}`}
                        onClick={() =>
                          patch({ quiz: plan.quiz.filter((_, j) => j !== i) })
                        }
                      >
                        ✕
                      </button>
                    </div>
                    <ul className="designer-options">
                      {q.options.map((o, k) => (
                        <li
                          key={k}
                          className={k === q.correct_index ? "designer-right" : ""}
                        >
                          {k === q.correct_index ? "✔ " : ""}
                          {o}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <p className="form-hint">
                لتغيير الإجابة الصحيحة أو نصّ الخيارات، افتح الدرس في محرّره
                بعد الحفظ.
              </p>
            </Block>
          )}

          {/* ----- النشاط ----- */}
          {plan.activity && (
            <Block
              name="withActivity"
              title={`🎮 نشاط مقترح — ${kindSpec(plan.activity.kind).label}`}
              count={plan.activity.items.length}
            >
              <p className="form-hint">
                يُنشأ نشاطاً مستقلاً مسودّةً، مرتبطاً بهذا الدرس. راجعه في صفحة
                الأنشطة قبل نشره.
              </p>
              <ul className="designer-options">
                {plan.activity.items.slice(0, 6).map((it, i) => (
                  <li key={i}>
                    {it.a} — {it.b}
                  </li>
                ))}
                {plan.activity.items.length > 6 && (
                  <li>… و{plan.activity.items.length - 6} أخرى</li>
                )}
              </ul>
            </Block>
          )}

          {/* ----- الحفظ ----- */}
          <label className="form-field">
            <span className="form-label">
              الوحدة
              <InfoTip>
                الوحدة تجمع دروساً متتابعة في منهج واحد. يمكنك تركه بلا وحدة
                ونقله لاحقاً من محرّر الدرس.
              </InfoTip>
            </span>
            <select name="unitId" defaultValue="">
              <option value="">— بلا وحدة —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </label>

          <p className="form-hint">
            💡 الدرس يُحفظ <strong>مسودّة</strong> — لا يراه أحد حتى تراجعه
            وتنشره من محرّر الدرس.
          </p>

          <div className="card-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…جارٍ الحفظ" : "💾 احفظه كحصّة"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPlan(EMPTY_PLAN)}
            >
              🗑 تجاهل هذه الخطّة
            </button>
          </div>

          {saveState.message && (
            <p className={saveState.ok ? "form-ok" : "form-error"}>
              {saveState.message}
            </p>
          )}
        </form>
      )}

      {!ready && !generating && (
        <p className="form-hint">
          بعد التصميم ستظهر هنا خطّةٌ كاملة تراجعها وتعدّلها، ثم تحفظها حصّةً
          في منهجك. وإن كنت تفضّل الكتابة بنفسك،{" "}
          <Link href="/teacher/me/lessons/new">ابدأ درساً فارغاً</Link>.
        </p>
      )}
    </div>
  );
}

/** كتلة قابلة للإبقاء أو الاستبعاد — المفتاح هو ما يقرؤه الخادم */
function Block({
  name,
  title,
  count,
  children,
}: {
  name: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="designer-block">
      <label className="stage-option designer-keep">
        <input type="checkbox" name={name} defaultChecked />
        <span>
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </span>
      </label>
      {children}
    </div>
  );
}

/**
 * معاينة HTML المولَّد.
 *
 * `dangerouslySetInnerHTML` هنا آمنة لأن النصّ **عُقِّم في الخادم** بنفس
 * `sanitizeLessonHtml` الذي يمرّ به شرح المعلّم، ويُعقَّم ثانيةً عند الحفظ.
 * لا تُمرّر إلى هنا HTML من مصدرٍ لم يمرّ بالمعقّم.
 */
function Preview({ html }: { html: string }) {
  return (
    <div
      className="designer-preview lesson-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** مثالٌ من مادّة المعلّم نفسه — «مثال: نصّ» عامٌّ لا يوحي بشيء */
function exampleFor(subject: string): string {
  const s = subject || "";
  if (/رياض/.test(s)) return "جمع الكسور المتشابهة";
  if (/عرب/.test(s)) return "الفاعل ونائب الفاعل";
  if (/علوم|أحياء|فيزياء|كيمياء/.test(s)) return "دورة الماء في الطبيعة";
  if (/إنجليز|انجليز|English/i.test(s)) return "الأزمنة البسيطة Present Simple";
  if (/تاريخ|جغراف|اجتماع/.test(s)) return "أسباب الثورة الصناعية";
  if (/حاسوب|برمج|تقنية/.test(s)) return "المتغيّرات في البرمجة";
  return "الدرس الأول من الوحدة الثانية";
}
