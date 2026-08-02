"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPlay } from "@/app/actions/activities";
import { kindSpec } from "@/lib/activityKinds";
import MatchGame from "@/components/games/MatchGame";
import QuizGame from "@/components/games/QuizGame";
import FlashcardsGame from "@/components/games/FlashcardsGame";
import AnagramGame from "@/components/games/AnagramGame";
import SortGame from "@/components/games/SortGame";
import WheelGame from "@/components/games/WheelGame";
import MemoryGame from "@/components/games/MemoryGame";
import TrueFalseGame from "@/components/games/TrueFalseGame";
import BalloonsGame from "@/components/games/BalloonsGame";
import SpeedGame from "@/components/games/SpeedGame";
import type { StudentActivity } from "@/lib/data/types";

/**
 * قشرة اللاعب: تشغّل اللعبة المناسبة للنوع، ثم تحفظ النتيجة وتعرضها.
 *
 * الألعاب لا تعرف شيئاً عن قاعدة البيانات — مخرجها الوحيد `onFinish`.
 * فإضافة لعبة جديدة ملفٌّ واحد وسطرٌ في هذا التوزيع.
 */
export default function ActivityPlayer({
  activity,
  preview = false,
}: {
  activity: StudentActivity;
  /** معاينة المعلّم: تُلعَب اللعبة ولا تُسجَّل نتيجة */
  preview?: boolean;
}) {
  const router = useRouter();
  const spec = kindSpec(activity.kind);
  const [busy, startTransition] = useTransition();
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const startedAt = useRef<number>(0);

  const finish = useCallback(
    (score: number, total: number) => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      setResult({ score, total });
      setPlaying(false);
      setErr("");
      if (preview) return;
      startTransition(async () => {
        const res = await recordPlay(activity.id, score, total, seconds);
        if (!res.ok) setErr(res.message ?? "تعذّر حفظ نتيجتك.");
        router.refresh();
      });
    },
    [activity.id, router, preview]
  );

  function start() {
    setResult(null);
    setErr("");
    startedAt.current = Date.now();
    setRound((r) => r + 1);
    setPlaying(true);
  }

  if (!playing) {
    return (
      <div className="activity-intro">
        <span className="activity-kind-badge">
          {spec.icon} {spec.label}
        </span>
        {activity.instructions && <p className="exam-intro">{activity.instructions}</p>}

        {result && (
          <div className="activity-result">
            {result.total > 0 ? (
              <>
                {result.score === result.total && (
                  <div className="confetti" aria-hidden="true">
                    {Array.from({ length: 14 }, (_, i) => (
                      <span key={i} className={`confetti-bit confetti-${i % 5}`} />
                    ))}
                  </div>
                )}
                <p className="exam-score">
                  {result.score} من {result.total}
                </p>
                <p className="form-ok">
                  {result.score === result.total
                    ? "🎉 كامل! أحسنت."
                    : result.score >= result.total * 0.7
                      ? "👏 نتيجة جيّدة — أعِدها لتتقنها."
                      : "💪 أعِد المحاولة، ستتحسّن."}
                </p>
              </>
            ) : (
              <p className="form-ok">✓ أنهيت النشاط.</p>
            )}
          </div>
        )}

        {!result && activity.bestScore !== null && activity.bestTotal ? (
          <p className="form-hint">
            أفضل نتيجة لك: {activity.bestScore} من {activity.bestTotal} · لعبتها{" "}
            {activity.plays} مرّة
          </p>
        ) : null}

        <button type="button" className="btn btn-primary" onClick={start}>
          {result ? "🔁 العب مرّة أخرى" : "▶️ ابدأ"}
        </button>

        {busy && <p className="form-hint">…جارٍ حفظ نتيجتك</p>}
        {err && <p className="form-error">{err}</p>}
        <p className="form-hint">
          {preview
            ? "معاينة — لا تُسجَّل نتيجة، وهكذا يراها طلابك تماماً."
            : "هذا نشاط للتدريب — نتيجته تشجيعٌ لك ولا تدخل في علاماتك الرسمية."}
        </p>
      </div>
    );
  }

  // `key` يعيد بناء اللعبة في كل جولة، فتُخلَط من جديد ولا تحمل حالة سابقة
  const props = { items: activity.items, onFinish: finish };
  return (
    <div className="activity-stage">
      {activity.kind === "match" && <MatchGame key={round} {...props} />}
      {activity.kind === "quiz" && <QuizGame key={round} {...props} />}
      {activity.kind === "flashcards" && <FlashcardsGame key={round} {...props} />}
      {activity.kind === "anagram" && <AnagramGame key={round} {...props} />}
      {activity.kind === "sort" && <SortGame key={round} {...props} />}
      {activity.kind === "wheel" && <WheelGame key={round} {...props} />}
      {activity.kind === "memory" && <MemoryGame key={round} {...props} />}
      {activity.kind === "truefalse" && <TrueFalseGame key={round} {...props} />}
      {activity.kind === "balloons" && <BalloonsGame key={round} {...props} />}
      {activity.kind === "speed" && <SpeedGame key={round} {...props} />}

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setPlaying(false)}
        >
          إيقاف
        </button>
      </div>
    </div>
  );
}
