"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteMedia } from "@/lib/mediaStore";

export type DraftMediaKind = "image" | "video" | "file";

/** مرجع لملف مرفوع — البيانات الفعلية (Blob) في IndexedDB عبر lib/mediaStore */
export interface DraftMedia {
  id: string;
  kind: DraftMediaKind;
  name: string;
  mime: string;
  size: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

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
  media: DraftMedia[];
  quiz: QuizQuestion[];
  createdAt: string;
}

const draftsKey = (teacherSlug: string) => `hissa-drafts:${teacherSlug}`;
const DRAFTS_EVENT = "hissa-drafts-change";

function readDrafts(teacherSlug: string): LessonDraft[] {
  try {
    const raw = localStorage.getItem(draftsKey(teacherSlug));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // مسودات قديمة (قبل إضافة الوسائط والأسئلة) تُطبَّع بحقول فارغة
    return parsed.map((d: LessonDraft) => ({
      ...d,
      media: Array.isArray(d.media) ? d.media : [],
      quiz: Array.isArray(d.quiz) ? d.quiz : [],
    }));
  } catch {
    return [];
  }
}

/** مسودات الحصص التي صممها المعلم، محفوظة محلياً لحين وجود باكند */
export function useLessonDrafts(teacherSlug: string) {
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setDrafts(readDrafts(teacherSlug));
    sync();
    setLoaded(true);
    window.addEventListener(DRAFTS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DRAFTS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [teacherSlug]);

  const persist = useCallback(
    (next: LessonDraft[]) => {
      setDrafts(next);
      try {
        localStorage.setItem(draftsKey(teacherSlug), JSON.stringify(next));
      } catch {
        /* التخزين غير متاح — تبقى المسودات في الذاكرة */
      }
      window.dispatchEvent(new Event(DRAFTS_EVENT));
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
      const current = readDrafts(teacherSlug);
      const target = current.find((d) => d.id === id);
      persist(current.filter((d) => d.id !== id));
      if (target && target.media.length > 0) {
        void deleteMedia(target.media.map((m) => m.id));
      }
    },
    [persist, teacherSlug]
  );

  return { drafts, loaded, addDraft, removeDraft };
}
