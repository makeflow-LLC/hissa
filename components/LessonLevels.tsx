"use client";

import { useEffect, useState } from "react";
import {
  LEVEL_ABOUT,
  LEVEL_ICON,
  LEVEL_LABEL,
  type ReadingLevel,
} from "@/lib/ai/levels";
import type { ContentSection } from "@/lib/data/types";

const STORE_KEY = "hissa:reading-level";

/**
 * مبدّل مستوى القراءة — **يختاره الطالب لا يُفرض عليه**.
 *
 * فكّرتُ في اشتقاقه من `profiles.grade` وتركتُه: الصفّ حقلٌ نصّيّ حرّ
 * («الصف السابع»، «سابع»، «7»)، وتخمينٌ خاطئ يحجب الدرس الحقيقي عن طالبٍ
 * قويّ ولا يعرف لماذا. والاختيار ضغطةٌ واحدة تُحفظ في `localStorage` —
 * هناك لا في القاعدة، لأنه تفضيل عرضٍ لا بيانات تعليمية.
 *
 * وكل الـHTML الواصل إلى هنا **مُعقَّمٌ في الخادم** بـ`sanitizeLessonHtml`،
 * مرّةً عند الحفظ ومرّةً عند العرض — كشرح الدرس الأصلي تماماً.
 */
export default function LessonLevels({
  standard,
  levels,
}: {
  standard: ContentSection[];
  levels: { level: "simple" | "advanced"; sections: ContentSection[] }[];
}) {
  const has = (l: "simple" | "advanced") => levels.some((x) => x.level === l);
  const available: ReadingLevel[] = [
    ...(has("simple") ? (["simple"] as const) : []),
    "standard",
    ...(has("advanced") ? (["advanced"] as const) : []),
  ];

  const [level, setLevel] = useState<ReadingLevel>("standard");

  // القراءة في تأثير لا في العرض: لا `localStorage` على الخادم
  useEffect(() => {
    const saved = window.localStorage.getItem(STORE_KEY);
    if (saved === "simple" || saved === "advanced" || saved === "standard")
      setLevel(saved);
  }, []);

  // مستوىً محفوظٌ غير متاح في هذا الدرس يعود إلى الأصلي بلا ضجّة
  const active: ReadingLevel = available.includes(level) ? level : "standard";
  const shown =
    active === "standard"
      ? standard
      : (levels.find((l) => l.level === active)?.sections ?? standard);

  return (
    <>
      {available.length > 1 && (
        <div className="level-switch">
          <span className="level-switch-label">مستوى الشرح</span>
          <div className="level-chips" role="radiogroup" aria-label="مستوى الشرح">
            {available.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active === l}
                className={`level-chip ${active === l ? "level-chip-on" : ""}`}
                onClick={() => {
                  setLevel(l);
                  window.localStorage.setItem(STORE_KEY, l);
                }}
              >
                <span aria-hidden="true">{LEVEL_ICON[l]}</span> {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
          <p className="level-about">{LEVEL_ABOUT[active]}</p>
        </div>
      )}

      <article className="lesson-content">
        {shown.map((section, si) => (
          <section key={`${active}-${si}`}>
            {section.heading && (
              <h2 className="content-heading">{section.heading}</h2>
            )}
            {section.html ? (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            ) : (
              (section.paragraphs ?? []).map((p, i) => (
                <p key={i} className="content-paragraph">
                  {p}
                </p>
              ))
            )}
          </section>
        ))}
      </article>
    </>
  );
}
