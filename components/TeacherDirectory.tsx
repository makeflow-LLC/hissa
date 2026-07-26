"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STAGES, subjects, teachers, type Stage } from "@/lib/teachers";

export default function TeacherDirectory() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [subject, setSubject] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    return teachers.filter(
      (t) =>
        (!q || t.name.includes(q)) &&
        (!stage || t.stage === stage) &&
        (!subject || t.subject === subject)
    );
  }, [query, stage, subject]);

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
          onChange={(e) => setStage(e.target.value as Stage | "")}
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
        <p className="empty-state">لا توجد نتائج مطابقة — جرّب تعديل البحث أو الفلاتر.</p>
      ) : (
        <div className="teachers-grid">
          {filtered.map((t) => (
            <article key={t.slug} className="teacher-card">
              <div className="teacher-avatar" style={{ background: t.gradient }}>
                {t.initials}
              </div>
              <h2 className="teacher-name">{t.name}</h2>
              <div className="teacher-tags">
                <span className="tag tag-subject">{t.subject}</span>
                <span className="tag tag-stage">{t.stage}</span>
              </div>
              <Link href={`/teacher/${t.slug}`} className="btn btn-primary">
                عرض البروفايل
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
