"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readLessonAloud,
  clearLessonAudio,
  type AudioState,
} from "@/app/actions/lesson-audio";
import { CREDIT_COST, creditWord } from "@/lib/ai/credits";

const initial: AudioState = { ok: false };

/**
 * تحويل شرح الدرس إلى صوت.
 *
 * ملفٌّ واحد لكل درس يسمعه الطالب في صفحة الدرس — لمن يقرأ ببطء، ولمن
 * يراجع في الطريق، ولمن لا يستطيع القراءة أصلاً. والتوليد يستبدل الملفّ
 * القديم، فلا تتراكم نسخٌ لدرسٍ واحد.
 */
export default function LessonAudio({
  lessonId,
  audioUrl,
  credits,
}: {
  lessonId: string;
  audioUrl: string | null;
  credits: number;
}) {
  const router = useRouter();
  const [state, run, busy] = useActionState(readLessonAloud, initial);
  const [cleared, setCleared] = useState(false);

  const url = state.audioUrl ?? (cleared ? null : audioUrl);
  const left = state.remaining ?? credits;
  const canAfford = left >= CREDIT_COST.tts;

  return (
    <div className="lesson-audio">
      {url && (
        <>
          {/* عنصر الصوت الأصليّ: يتكفّل المتصفّح بالتشغيل والسرعة والتنزيل */}
          <audio src={url} controls preload="none" className="lesson-audio-player">
            متصفّحك لا يدعم تشغيل الصوت.
          </audio>
          <div className="card-actions">
            <a
              href={url}
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
                if (!window.confirm("إزالة صوت هذا الدرس؟")) return;
                await clearLessonAudio(lessonId);
                setCleared(true);
                router.refresh();
              }}
            >
              🗑 إزالة
            </button>
          </div>
        </>
      )}

      <form action={run} className="card-actions">
        <input type="hidden" name="lessonId" value={lessonId} />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !canAfford}
        >
          {busy
            ? "…يقرأ الدرس"
            : url
              ? `🔁 أعِد التوليد — ${creditWord(CREDIT_COST.tts)}`
              : `🔊 حوّل الدرس إلى صوت — ${creditWord(CREDIT_COST.tts)}`}
        </button>
        <span className="form-hint">رصيدك: {left}</span>
      </form>

      {!canAfford && (
        <p className="form-error">رصيدك لا يكفي. تواصل مع الإدارة لشحنه.</p>
      )}
      {busy && (
        <p className="form-hint">
          القراءة تستغرق نحو ثانيةٍ لكل عشر ثوانٍ من الصوت — لا تُغلق الصفحة.
        </p>
      )}
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>
          {state.message}
          {state.ok && state.seconds ? ` (${state.seconds} ثانية)` : ""}
        </p>
      )}
    </div>
  );
}
