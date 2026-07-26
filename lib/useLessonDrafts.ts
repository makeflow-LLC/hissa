"use client";

import { useCallback, useEffect, useState } from "react";

export interface LessonDraft {
  id: string;
  kind: "recorded" | "live";
  title: string;
  description: string;
  unitTitle: string;
  duration: string;
  emoji: string;
  /** نص الشرح (للمسجّل) أو الموعد (للمباشر) */
  detail: string;
  createdAt: string;
}

const draftsKey = (teacherSlug: string) => `hissa-drafts:${teacherSlug}`;

function readDrafts(teacherSlug: string): LessonDraft[] {
  try {
    const raw = localStorage.getItem(draftsKey(teacherSlug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** مسودات الحصص التي صممها المعلم، محفوظة محلياً لحين وجود باكند */
export function useLessonDrafts(teacherSlug: string) {
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts(teacherSlug));
    setLoaded(true);
  }, [teacherSlug]);

  const persist = useCallback(
    (next: LessonDraft[]) => {
      setDrafts(next);
      try {
        localStorage.setItem(draftsKey(teacherSlug), JSON.stringify(next));
      } catch {
        /* التخزين غير متاح — تبقى المسودات في الذاكرة */
      }
    },
    [teacherSlug]
  );

  const addDraft = useCallback(
    (draft: Omit<LessonDraft, "id" | "createdAt">) => {
      const full: LessonDraft = {
        ...draft,
        id: `draft-${Date.now()}`,
        createdAt: new Date().toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };
      persist([full, ...readDrafts(teacherSlug)]);
      return full;
    },
    [persist, teacherSlug]
  );

  const removeDraft = useCallback(
    (id: string) => {
      persist(readDrafts(teacherSlug).filter((d) => d.id !== id));
    },
    [persist, teacherSlug]
  );

  return { drafts, loaded, addDraft, removeDraft };
}
