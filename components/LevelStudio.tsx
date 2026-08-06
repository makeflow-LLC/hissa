"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { generateLevel, deleteLevel, type LevelState } from "@/app/actions/lesson-levels";
import {
  GENERATED_LEVELS,
  LEVEL_ABOUT,
  LEVEL_ICON,
  LEVEL_LABEL,
} from "@/lib/ai/levels";
import { CREDIT_COST, creditWord } from "@/lib/ai/credits";
import type { LevelSections } from "@/lib/data/queries";

const initial: LevelState = { ok: false };

/**
 * توليد نسخةٍ أسهل أو أعمق من الدرس.
 *
 * **النسخة تُحفظ داخل الدرس لا في ملفّ**: يبدّل الطالب مستواه من صفحة
 * الدرس نفسها، ويبقى تقدّمه واختباره على الدرس الواحد — وهذا هو الفرق
 * عن أدوات التصدير التي تنتهي عندها الحلقة.
 */
export default function LevelStudio({
  lessonId,
  credits,
  levels,
}: {
  lessonId: string;
  credits: number;
  levels: LevelSections[];
}) {
  const router = useRouter();
  const [state, run, busy] = useActionState(generateLevel, initial);
  const [preview, setPreview] = useState<"simple" | "advanced" | null>(null);

  const left = state.remaining ?? credits;
  const canAfford = left >= CREDIT_COST.level;

  return (
    <div className="level-studio">
      {GENERATED_LEVELS.map((lv) => {
        const existing = levels.find((l) => l.level === lv);
        return (
          <section key={lv} className="dashboard-section">
            <div className="section-head-row">
              <h2 className="section-title">
                {LEVEL_ICON[lv]} النسخة الـ{LEVEL_LABEL[lv]}
                {existing && (
                  <span className="pill pill-live"> جاهزة · {existing.sections.length} أقسام</span>
                )}
              </h2>
            </div>
            <p className="form-hint">{LEVEL_ABOUT[lv]}</p>

            <form action={run} className="card-actions">
              <input type="hidden" name="lessonId" value={lessonId} />
              <input type="hidden" name="level" value={lv} />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={busy || !canAfford}
              >
                {busy
                  ? "…يُعيد الكتابة"
                  : existing
                    ? `🔁 أعِد التوليد — ${creditWord(CREDIT_COST.level)}`
                    : `✨ ولّد النسخة — ${creditWord(CREDIT_COST.level)}`}
              </button>
              {existing && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPreview(preview === lv ? null : lv)}
                  >
                    {preview === lv ? "أخفِ" : "👁 عاين"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-danger"
                    onClick={async () => {
                      if (!window.confirm(`حذف النسخة الـ${LEVEL_LABEL[lv]}؟`)) return;
                      await deleteLevel(lessonId, lv);
                      router.refresh();
                    }}
                  >
                    🗑
                  </button>
                </>
              )}
            </form>

            {preview === lv && existing && (
              <div className="level-preview">
                {existing.sections.map((s, i) => (
                  <div key={i}>
                    {s.heading && <h3 className="content-heading">{s.heading}</h3>}
                    <div
                      className="rich-content"
                      dangerouslySetInnerHTML={{ __html: s.html ?? "" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <p className="form-hint">
        رصيدك: <strong>{left}</strong>
        {!canAfford && " — لا يكفي. تواصل مع الإدارة لشحنه."}
      </p>
      {busy && (
        <p className="form-hint">
          يُعيد النموذج كتابة كل قسمٍ بنفس المعنى — لا تُغلق الصفحة.
        </p>
      )}
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </div>
  );
}
