"use client";

import { useCallback, useEffect, useState } from "react";

const storageKey = (teacherSlug: string) => `hissa-progress:${teacherSlug}`;

function readCompleted(teacherSlug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(teacherSlug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * تقدّم الطالب في دروس معلم معين، محفوظ في localStorage.
 * القراءة تتم بعد الـ mount لتطابق ترميز الخادم (SSR) مع العميل.
 */
export function useLessonProgress(teacherSlug: string) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCompleted(readCompleted(teacherSlug));
    setLoaded(true);
  }, [teacherSlug]);

  const toggle = useCallback(
    (lessonId: string) => {
      setCompleted((prev) => {
        const next = prev.includes(lessonId)
          ? prev.filter((id) => id !== lessonId)
          : [...prev, lessonId];
        try {
          localStorage.setItem(storageKey(teacherSlug), JSON.stringify(next));
        } catch {
          /* التخزين غير متاح (وضع التصفح الخاص مثلاً) — نكتفي بالحالة المؤقتة */
        }
        return next;
      });
    },
    [teacherSlug]
  );

  const isCompleted = useCallback(
    (lessonId: string) => completed.includes(lessonId),
    [completed]
  );

  return { completed, loaded, toggle, isCompleted };
}
