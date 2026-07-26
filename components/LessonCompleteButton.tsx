"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLessonComplete } from "@/app/actions/student";

interface Props {
  lessonId: string;
  teacherSlug: string;
  isCompleted: boolean;
  isAuthed: boolean;
}

export default function LessonCompleteButton({
  lessonId,
  teacherSlug,
  isCompleted,
  isAuthed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isAuthed) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-complete"
        onClick={() =>
          router.push(
            `/login?next=${encodeURIComponent(
              `/teacher/${teacherSlug}/lesson/${lessonId}`
            )}`
          )
        }
      >
        🔒 سجّل الدخول لحفظ تقدّمك
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-complete ${
        isCompleted ? "btn-complete-done" : "btn-primary"
      }`}
      disabled={pending}
      title={isCompleted ? "اضغط للتراجع عن الإنجاز" : "علّم هذا الدرس كمنجز"}
      onClick={() =>
        startTransition(async () => {
          await toggleLessonComplete(lessonId, teacherSlug, isCompleted);
          router.refresh();
        })
      }
    >
      {pending ? "…" : isCompleted ? "✓ الدرس منجز" : "تم الإنجاز"}
    </button>
  );
}
