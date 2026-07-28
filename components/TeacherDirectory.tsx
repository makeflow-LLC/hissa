"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Stars from "@/components/Stars";
import type { TeacherCard } from "@/lib/data/types";

const STAGES = ["ابتدائي", "إعدادي", "ثانوي"] as const;

export default function TeacherDirectory({ teachers }: { teachers: TeacherCard[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [subject, setSubject] = useState("");

  const subjects = useMemo(
    () => [...new Set(teachers.map((t) => t.subject))],
    [teachers]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return teachers.filter(
      (t) =>
        (!q || t.name.includes(q)) &&
        (!stage || t.stages.includes(stage)) &&
        (!subject || t.subject === subject)
    );
  }, [teachers, query, stage, subject]);

  return (
    <>
      <div className="filters" role="search">
        <input
          type="search"
          className="search-input"
          placeholder="ابحث عن معلّم بالاسم…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="البحث بالاسم"
        />
        <select
          className="filter-select"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          aria-label="فلترة حسب المرحلة"
        >
          <option value="">كل المراحل</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="فلترة حسب المادة"
        >
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        teachers.length === 0 ? (
          // لا معلّمين بعد على المنصة إطلاقاً — ليست مشكلة بحث
          <div className="empty-state">
            <p>لا يوجد معلّمون منشورون بعد.</p>
            <p>
              كن أول معلّم على المنصة —{" "}
              <Link href="/teacher/join" className="back-link">
                انضم كمعلّم
              </Link>
              .
            </p>
          </div>
        ) : (
          <p className="empty-state">لا توجد نتائج مطابقة — جرّب تعديل البحث أو الفلاتر.</p>
        )
      ) : (
        <div className="teachers-grid">
          {filtered.map((t) => (
            <article key={t.id} className="teacher-card">
              {t.avatar_url ? (
                // صور المعلمين قد تكون data URL أو من Storage — خارج نطاق next/image
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar_url} alt={t.name} className="teacher-avatar-img" />
              ) : (
                <div className="teacher-avatar" style={{ background: t.gradient }}>
                  {t.initials}
                </div>
              )}
              <h2 className="teacher-name">{t.name}</h2>
              <div className="teacher-tags">
                <span className="tag tag-subject">{t.subject}</span>
                {t.stages.map((s) => (
                  <span key={s} className="tag tag-stage">
                    {s}
                  </span>
                ))}
              </div>
              {t.rating_count > 0 ? (
                <div className="teacher-rating">
                  <Stars rating={Number(t.rating)} />
                  <span className="teacher-rating-value">{t.rating}</span>
                  <span className="teacher-rating-count">
                    ({t.rating_count} تقييماً)
                  </span>
                </div>
              ) : (
                <div className="teacher-rating teacher-rating-none">معلّم جديد</div>
              )}
              <p className="teacher-counts">
                👥 {t.studentCount} طالباً · 🎬 {t.lessonCount} درساً · 📚{" "}
                {t.unitCount} وحدة
              </p>
              <Link href={`/teacher/${t.slug}`} className="btn btn-primary">
                📚 ادخل إلى الدروس
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
