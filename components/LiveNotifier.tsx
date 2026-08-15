"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Toast {
  id: number;
  icon: string;
  text: string;
}

/**
 * نصّ الإشعار بحسب وجهة الرسالة.
 *
 * RLS هي المرشِّح: ما وصل الطالب أصلاً هو ما يجوز له قراءته، فيكفي هنا
 * تسميته باسمه — خاصّة، أو تعميم لمجموعته، أو تعميم عام.
 */
function messageLabel(studentId: string | null, groupId: string | null): string {
  if (studentId) return "رسالة جديدة من معلّمك";
  if (groupId) return "تعميم جديد لمجموعتك";
  return "إعلان جديد من معلّمك";
}

/**
 * نغمة تنبيه قصيرة تُولَّد برمجياً.
 *
 * لا نشحن ملف صوت: نغمتان قصيرتان عبر Web Audio أخفّ من أي mp3 وتعملان
 * دون طلب شبكة. المتصفّحات تمنع تشغيل الصوت قبل أول تفاعل من المستخدم،
 * فنُنشئ السياق كسولاً ونحاول استئنافه — وإن رُفض بقي الإشعار المرئي.
 */
function useChime() {
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
      void ctxRef.current?.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    void ctx.resume();
    const now = ctx.currentTime;
    // نغمتان صاعدتان — تُميَّز عن أصوات النظام ولا تُزعج
    [
      [880, 0],
      [1175, 0.12],
    ].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.24);
    });
  }, []);
}

export default function LiveNotifier({
  role,
  userId,
  teacherId,
}: {
  role: "student" | "teacher";
  userId: string;
  /** صف المعلّم الحالي — لتصفية أحداث طلبات الانضمام والتقييم */
  teacherId?: string;
}) {
  const router = useRouter();
  const chime = useChime();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (icon: string, text: string) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((prev) => [...prev, { id, icon, text }].slice(-3));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 7000);

      chime();

      // إشعار النظام حين تكون الصفحة في الخلفية فقط — لا نُكرّر ما هو ظاهر
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        document.visibilityState === "hidden"
      ) {
        try {
          new Notification("منصة حصة", { body: text, icon: "/icon-192.png" });
        } catch {
          /* بعض المتصفّحات تمنع الإنشاء المباشر — الإشعار المرئي يكفي */
        }
      }

      // نجمّع التحديثات: عدّة أحداث متتابعة تُنعش الصفحة مرّة واحدة
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 600);
    },
    [chime, router]
  );

  /**
   * خطّة بديلة حين يتعذّر الاتصال اللحظي.
   *
   * شبكات المدارس تحجب WebSocket كثيراً — وهي بالضبط شبكة جمهورنا. فبدل
   * أن تموت الإشعارات صامتةً هناك، نستعلم كل ٢٠ ثانية عن أحدث رسالة
   * (بالقراءة نفسها التي تحكمها RLS) وننبّه إن جدّ شيء.
   */
  const lastSeen = useRef<string>(new Date().toISOString());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const supabase = createClient();
    pollRef.current = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      const { data } = await supabase
        .from("teacher_messages")
        .select("created_at, sender, student_id, group_id")
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (data ?? [])[0] as
        | {
            created_at: string;
            sender: string;
            student_id: string | null;
            group_id: string | null;
          }
        | undefined;
      if (!row || row.created_at <= lastSeen.current) return;
      lastSeen.current = row.created_at;
      if (role === "teacher" && row.sender === "student") {
        notify("✉️", "رسالة جديدة من طالب");
      } else if (role === "student" && row.sender === "teacher") {
        notify("✉️", messageLabel(row.student_id, row.group_id));
      }
    }, 20000);
  }, [role, notify]);

  useEffect(() => {
    const supabase = createClient();

    /**
     * لا نضع مرشِّحات على القناة: صفوف RLS هي المرشِّح الحقيقي، فلا يصل
     * المشترك إلا ما يحقّ له قراءته أصلاً. نتحقّق من الحقول هنا لتحديد
     * نصّ الإشعار لا لضبط الصلاحية.
     */
    const channel = supabase
      .channel(`hissa-live-${role}-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "teacher_messages" },
        (payload) => {
          const row = payload.new as {
            sender?: string;
            student_id?: string | null;
            group_id?: string | null;
          };
          if (role === "teacher") {
            if (row.sender === "student") notify("✉️", "رسالة جديدة من طالب");
          } else if (row.sender === "teacher") {
            notify("✉️", messageLabel(row.student_id ?? null, row.group_id ?? null));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_card_requests" },
        (payload) => {
          const row = payload.new as { teacher_id?: string };
          if (role === "teacher" && row.teacher_id === teacherId) {
            notify("🏅", "طالب يطلب بطاقة تقييم");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_cards" },
        (payload) => {
          const row = payload.new as { student_id?: string };
          if (role === "student" && row.student_id === userId) {
            notify("🏅", "وصلتك بطاقة تقييم جديدة");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "follows" },
        (payload) => {
          const row = payload.new as { teacher_id?: string; status?: string };
          if (
            role === "teacher" &&
            row.teacher_id === teacherId &&
            row.status === "pending"
          ) {
            notify("🙋", "طلب انضمام جديد");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "follows" },
        (payload) => {
          const row = payload.new as { student_id?: string; status?: string };
          if (role !== "student" || row.student_id !== userId) return;
          if (row.status === "approved") notify("🎓", "قُبل طلب انضمامك");
          if (row.status === "rejected") notify("🙋", "بُتَّ في طلب انضمامك");
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_bookings" },
        (payload) => {
          const row = payload.new as { teacher_id?: string };
          if (role === "teacher" && row.teacher_id === teacherId) {
            notify("🗓", "طلب حجز موعد جديد");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_bookings" },
        (payload) => {
          const row = payload.new as { student_id?: string; status?: string };
          if (role !== "student" || row.student_id !== userId) return;
          if (row.status === "approved") notify("🎥", "تأكّد حجزك ووصلك رابط اللقاء");
          if (row.status === "rejected") notify("🗓", "اعتذر المعلّم عن موعدك");
        }
      )
      .subscribe((status) => {
        // فشل القناة أو انقطاعها ⇒ نستعيض بالاستطلاع بدل الصمت
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        }
      });

    // حتى لو لم تُطلق القناة حدث فشل، لا ننتظر إلى ما لا نهاية
    const guard = setTimeout(startPolling, 10000);

    return () => {
      clearTimeout(guard);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [role, userId, teacherId, notify, startPolling]);

  const askPermission =
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default";

  return (
    <>
      {askPermission && (
        <button
          type="button"
          className="btn btn-outline btn-sm live-perm"
          onClick={() => void Notification.requestPermission()}
        >
          🔔 فعّل إشعارات المتصفّح
        </button>
      )}
      <div className="live-toasts" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className="live-toast">
            <span className="live-toast-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}
