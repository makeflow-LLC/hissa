"use client";

import { useCallback, useEffect, useRef } from "react";

type Cue = "right" | "wrong" | "pop" | "win";

/**
 * أصوات قصيرة تُولَّد برمجياً — كنغمة الإشعارات، وللسبب نفسه.
 *
 * لا ملفّات صوت: النغمة عبر Web Audio أخفّ من أي mp3 وتعمل دون طلب شبكة،
 * وجمهور المنصة على شبكات مدرسية بطيئة. والمتصفّحات تمنع الصوت قبل أول
 * تفاعل، فيُنشأ السياق كسولاً عند أول ضغطة — وإن بقي ممنوعاً فاللعبة
 * تعمل كاملةً بلا صوت.
 */
export function useGameSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlock = () => {
      if (!ctxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) ctxRef.current = new Ctor();
      }
      ctxRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return useCallback((cue: Cue) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;

    const notes: Record<Cue, { f: number; t: number }[]> = {
      right: [
        { f: 660, t: 0 },
        { f: 880, t: 0.08 },
      ],
      wrong: [{ f: 180, t: 0 }],
      pop: [{ f: 520, t: 0 }],
      win: [
        { f: 523, t: 0 },
        { f: 659, t: 0.1 },
        { f: 784, t: 0.2 },
        { f: 1047, t: 0.3 },
      ],
    };

    for (const n of notes[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cue === "wrong" ? "sawtooth" : "sine";
      osc.frequency.value = n.f;
      const start = ctx.currentTime + n.t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }, []);
}
