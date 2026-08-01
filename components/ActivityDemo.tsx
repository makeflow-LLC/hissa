"use client";

import { useState } from "react";
import ActivityPlayer from "@/components/ActivityPlayer";
import { KINDS, kindSpec, type ActivityKind } from "@/lib/activityKinds";
import { ACTIVITY_DEMOS } from "@/lib/activityDemos";

/**
 * معرض الألعاب في صفحة الشرح: يختار المعلّم نوعاً فيلعبه فوراً.
 *
 * `preview` يمنع تسجيل أي نتيجة، والمعرّف الوهميّ لا يصل قاعدة البيانات
 * أصلاً لأن `recordPlay` لا تُستدعى في المعاينة.
 */
export default function ActivityDemo({ initial = "match" }: { initial?: ActivityKind }) {
  const [kind, setKind] = useState<ActivityKind>(initial);
  const spec = kindSpec(kind);
  const items = ACTIVITY_DEMOS[kind];

  return (
    <div className="demo-shell">
      <div className="kind-grid" role="tablist" aria-label="أنواع الأنشطة">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="tab"
            aria-selected={k.value === kind}
            className={`kind-chip ${k.value === kind ? "kind-chip-on" : ""}`}
            onClick={() => setKind(k.value)}
          >
            <span className="kind-icon" aria-hidden="true">
              {k.icon}
            </span>
            {k.label}
          </button>
        ))}
      </div>

      <div className="demo-body">
        <p className="demo-about">{spec.about}</p>
        <ul className="demo-facts">
          <li>
            <span className="group-meta">العمود الأول</span>
            <strong>{spec.labelA}</strong>
          </li>
          <li>
            <span className="group-meta">العمود الثاني</span>
            <strong>{spec.needsB ? spec.labelB : `${spec.labelB} — غير مطلوب`}</strong>
          </li>
          <li>
            <span className="group-meta">أقلّ عدد صفوف</span>
            <strong>{spec.min}</strong>
          </li>
          <li>
            <span className="group-meta">الدرجة</span>
            <strong>{spec.scored ? "تُحتسب وتُسجَّل" : "بلا درجة — تدريب فقط"}</strong>
          </li>
        </ul>

        {/* لا نستعمل <code> هنا: الخطّ الأحادي المسافة يقطع وصل الحروف
            العربية فتُقرأ «الـفـاعـل» — عيبٌ لا يظهر في الإنجليزية */}
        <p className="form-hint">
          مثال صفٍّ واحد: <span className="demo-example">{spec.exampleA}</span>
          {spec.needsB && spec.exampleB && (
            <>
              {" ← "}
              <span className="demo-example">{spec.exampleB}</span>
            </>
          )}
        </p>

        {/* مفتاح `kind` يعيد بناء المشغّل، فلا تتسرّب حالة لعبةٍ إلى أخرى */}
        <ActivityPlayer
          key={kind}
          preview
          activity={{
            id: "demo",
            title: spec.label,
            instructions: "نموذج تجريبيّ — العب كما سيلعب طالبك تماماً.",
            kind,
            items,
            teacherName: "منصة حصة",
            showLeaderboard: false,
            bestScore: null,
            bestTotal: null,
            plays: 0,
          }}
        />
      </div>
    </div>
  );
}
