"use client";

import { useCallback, useEffect, useState } from "react";
import type { Stage, Teacher } from "@/lib/teachers";

/**
 * تعديلات الملف الشخصي التي يحفظها المعلم من لوحة التحكم.
 * تُدمج فوق البيانات الأساسية في lib/teachers.ts عند العرض.
 */
export interface TeacherProfileOverrides {
  displayName?: string;
  bio?: string;
  /** رقم واتساب (اختياري) — يُعرض زر تواصل في البروفايل عند وجوده */
  whatsapp?: string;
  /** المراحل الدراسية التي يدرّسها (قد تكون أكثر من مرحلة) */
  stages?: Stage[];
  /** صورة/لوغو المعلم كـ data URL مصغّرة */
  avatar?: string;
}

const profileKey = (slug: string) => `hissa-teacher-profile:${slug}`;
const PROFILE_EVENT = "hissa-profile-change";

export function readProfileOverrides(slug: string): TeacherProfileOverrides {
  try {
    const raw = localStorage.getItem(profileKey(slug));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export interface MergedTeacherProfile {
  name: string;
  bio: string;
  stages: Stage[];
  whatsapp: string | null;
  avatar: string | null;
}

export function mergeTeacherProfile(
  teacher: Teacher,
  o: TeacherProfileOverrides
): MergedTeacherProfile {
  return {
    name: o.displayName?.trim() || teacher.name,
    bio: o.bio?.trim() || teacher.bio,
    stages: o.stages && o.stages.length > 0 ? o.stages : [teacher.stage],
    whatsapp: o.whatsapp?.trim() || null,
    avatar: o.avatar || null,
  };
}

/** قراءة/حفظ تعديلات ملف معلم واحد مع مزامنة كل النسخ عبر حدث مخصص */
export function useTeacherProfile(slug: string) {
  const [overrides, setOverrides] = useState<TeacherProfileOverrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setOverrides(readProfileOverrides(slug));
    sync();
    setLoaded(true);
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  const save = useCallback(
    (next: TeacherProfileOverrides) => {
      setOverrides(next);
      try {
        localStorage.setItem(profileKey(slug), JSON.stringify(next));
      } catch {
        /* التخزين غير متاح (أو الصورة أكبر من المساحة) — تبقى الحالة بالذاكرة */
      }
      window.dispatchEvent(new Event(PROFILE_EVENT));
    },
    [slug]
  );

  return { overrides, loaded, save };
}

/** قراءة تعديلات مجموعة معلمين دفعة واحدة (لبطاقات الصفحة الرئيسية) */
export function useAllProfileOverrides(slugs: string[]) {
  const [map, setMap] = useState<Record<string, TeacherProfileOverrides>>({});
  const key = slugs.join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    const sync = () =>
      setMap(Object.fromEntries(list.map((s) => [s, readProfileOverrides(s)])));
    sync();
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  return map;
}
