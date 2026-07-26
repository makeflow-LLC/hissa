"use client";

import { useLessonProgress } from "@/lib/useLessonProgress";

interface Props {
  teacherSlug: string;
  lessonId: string;
}

export default function LessonCompleteButton({ teacherSlug, lessonId }: Props) {
  const { loaded, isCompleted, toggle } = useLessonProgress(teacherSlug);
  const done = loaded && isCompleted(lessonId);

  return (
    <button
      type="button"
      className={`btn btn-complete ${done ? "btn-complete-done" : "btn-primary"}`}
      onClick={() => toggle(lessonId)}
      title={done ? "اضغط للتراجع عن الإنجاز" : "علّم هذا الدرس كمنجز"}
    >
      {done ? "✓ الدرس منجز" : "تم الإنجاز"}
    </button>
  );
}
