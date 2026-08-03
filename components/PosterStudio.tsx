"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import InfoTip from "@/components/InfoTip";
import {
  posterOptions,
  generatePoster,
  deletePoster,
  type PosterOptionsState,
  type PosterState,
} from "@/app/actions/poster";
import {
  POSTER_ABOUT,
  POSTER_ICON,
  POSTER_KINDS,
  POSTER_LABEL,
  type PosterKind,
  type PosterOption,
} from "@/lib/ai/poster";
import { CREDIT_COST, creditWord } from "@/lib/ai/credits";
import type { PosterRow } from "@/lib/data/queries";

const initialOptions: PosterOptionsState = { ok: false };
const initialPoster: PosterState = { ok: false };

/**
 * استوديو المواد المرئية: يقرأ النموذج الدرس، **يعرض ما يصلح فيه**، ثم
 * يرسم ما يختاره المعلّم.
 *
 * الخطوتان مقصودتان. درسٌ عن النبات يحتمل ملصقاً عن أجزائه أو عن الخلية
 * أو عن البناء الضوئي، ولا يعرف النموذج أيّها يريد المعلّم. فسؤاله أولاً
 * أرخص من رسم ثلاث صور ورمي اثنتين، ويجعل الاختيار للمعلّم لا للنموذج.
 * ولذلك أيضاً **الاقتراح بلا ثمن والرسم بثمنه**.
 */
export default function PosterStudio({
  lessonId,
  lessonTitle,
  credits,
  posters,
}: {
  lessonId: string;
  lessonTitle: string;
  credits: number;
  posters: PosterRow[];
}) {
  const router = useRouter();
  const [optState, askOptions, asking] = useActionState(posterOptions, initialOptions);
  const [genState, generate, drawing] = useActionState(generatePoster, initialPoster);

  const [kind, setKind] = useState<PosterKind>("poster");
  const [chosen, setChosen] = useState<PosterOption | null>(null);
  const [grade, setGrade] = useState("");

  const left = genState.remaining ?? credits;
  const canAfford = left >= CREDIT_COST.poster;

  return (
    <div className="poster-studio">
      {/* ===== ١) أيّ نوع؟ ===== */}
      <div className="form-field">
        <span className="form-label">
          ماذا تريد أن تُنتج؟
          <InfoTip>
            الثلاثة تُصنع من الدرس نفسه، ويختلف الشكل: الملصق للجدار،
            والبطاقة لليد، والمخطّط لشرح بنيةٍ أو تسلسل.
          </InfoTip>
        </span>
        <div className="kind-grid" role="radiogroup" aria-label="نوع المادّة">
          {POSTER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`kind-chip ${kind === k ? "kind-chip-on" : ""}`}
              onClick={() => {
                setKind(k);
                setChosen(null);
              }}
            >
              <span className="kind-icon" aria-hidden="true">
                {POSTER_ICON[k]}
              </span>
              {POSTER_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="hint">{POSTER_ABOUT[kind]}</p>
      </div>

      {/* ===== ٢) ما الذي يصلح في هذا الدرس؟ ===== */}
      <form action={askOptions} className="card-actions poster-ask">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="kind" value={kind} />
        <button type="submit" className="btn btn-primary" disabled={asking}>
          {asking ? "…يقرأ الدرس" : "🔍 ما الذي يصلح في هذا الدرس؟"}
        </button>
        <span className="form-hint">
          الاقتراح مجّاني — والرسم بـ{creditWord(CREDIT_COST.poster)}. رصيدك:{" "}
          <strong>{left}</strong>
        </span>
      </form>
      {optState.message && <p className="form-error">{optState.message}</p>}

      {/* ===== ٣) اختر موضوعاً ===== */}
      {optState.ok && optState.options && (
        <div className="form-field">
          <span className="form-label">
            اختر موضوع {POSTER_LABEL[kind]} — {optState.options.length} اقتراحات
          </span>
          <ul className="poster-options">
            {optState.options.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`poster-option ${
                    chosen?.title === o.title ? "poster-option-on" : ""
                  }`}
                  onClick={() => setChosen(o)}
                >
                  <strong className="poster-option-title">{o.title}</strong>
                  <span className="poster-option-blurb">{o.blurb}</span>
                  {o.visual && <span className="pill pill-draft">{o.visual}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== ٤) ارسمها ===== */}
      {chosen && (
        <form action={generate} className="exam-form poster-generate">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="topic" value={chosen.title} />
          <input type="hidden" name="blurb" value={chosen.blurb} />
          <input type="hidden" name="visual" value={chosen.visual} />

          <p className="form-hint">
            سيُرسم «{chosen.title}» من درس «{lessonTitle}»، ويُكتب اسمك أسفل
            التصميم.
          </p>

          <label className="form-field">
            <span className="form-label">الصفّ (اختياري — يُكتب مع اسمك)</span>
            <input
              type="text"
              name="grade"
              className="search-input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="مثال: الصف السابع"
              maxLength={80}
            />
          </label>

          <div className="card-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={drawing || !canAfford}
            >
              {drawing
                ? "…يرسم (قد يستغرق دقيقة)"
                : `🎨 ارسمها — ${creditWord(CREDIT_COST.poster)}`}
            </button>
            {!canAfford && (
              <span className="form-error">
                رصيدك {left} ولا يكفي. تواصل مع الإدارة لشحنه.
              </span>
            )}
          </div>

          {drawing && (
            <p className="form-hint">
              توليد الصورة أبطأ من النصّ — لا تُغلق الصفحة.
            </p>
          )}
          {genState.message && !genState.ok && (
            <p className="form-error">{genState.message}</p>
          )}
        </form>
      )}

      {/* ===== ٥) ما أُنتج ===== */}
      {(genState.imageUrl || posters.length > 0) && (
        <div className="form-field">
          <span className="form-label">🖼️ ما أنتجتَه لهذا الدرس</span>
          <p className="form-hint">
            الصورة ملكك: نزّلها واطبعها أو أدرجها في شرح الدرس من محرّره.
          </p>
          <ul className="poster-gallery">
            {/*
              الصورة الجديدة تظهر فوراً حتى قبل أن تصل الصفحة المحدَّثة من
              الخادم — نجاحٌ لا يُرى يُقرأ كفشل، وهذه صورةٌ دُفع ثمنها.
            */}
            {genState.imageUrl && !posters.some((p) => p.imageUrl === genState.imageUrl) && (
              <li className="poster-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={genState.imageUrl} alt="" className="poster-img" />
                <div className="card-actions">
                  <a
                    href={genState.imageUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    ⬇️ تنزيل
                  </a>
                </div>
              </li>
            )}
            {posters.map((p) => (
              <li key={p.id} className="poster-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.title} className="poster-img" />
                <strong className="poster-item-title">{p.title}</strong>
                <div className="card-actions">
                  <a
                    href={p.imageUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    ⬇️ تنزيل
                  </a>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-danger"
                    onClick={async () => {
                      if (!window.confirm(`حذف «${p.title}»؟`)) return;
                      await deletePoster(p.id);
                      router.refresh();
                    }}
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
