"use client";

import type { Teacher } from "@/lib/teachers";
import { mergeTeacherProfile, useTeacherProfile } from "@/lib/useTeacherProfile";
import Stars from "@/components/Stars";

/**
 * رأس بروفايل المعلم مع دمج تعديلات لوحة التحكم (الاسم/الصورة/النبذة/
 * المراحل/واتساب) فوق البيانات الأساسية. يُرمّز من الخادم بالبيانات
 * الأساسية ثم تُطبّق التعديلات بعد الـ mount.
 */
export default function TeacherProfileHeader({
  teacher,
  lessonCount,
}: {
  teacher: Teacher;
  lessonCount: number;
}) {
  const { overrides } = useTeacherProfile(teacher.slug);
  const merged = mergeTeacherProfile(teacher, overrides);
  const waDigits = merged.whatsapp?.replace(/[^0-9]/g, "") ?? "";

  return (
    <section className="profile-header">
      {merged.avatar ? (
        // صورة data URL محلية من localStorage — لا يفيد فيها next/image
        // eslint-disable-next-line @next/next/no-img-element
        <img src={merged.avatar} alt={merged.name} className="profile-avatar-img" />
      ) : (
        <div className="profile-avatar" style={{ background: teacher.gradient }}>
          {teacher.initials}
        </div>
      )}
      <h1 className="profile-name">{merged.name}</h1>
      <div className="teacher-tags">
        <span className="tag tag-subject">{teacher.subject}</span>
        {merged.stages.map((s) => (
          <span key={s} className="tag tag-stage">
            {s}
          </span>
        ))}
      </div>
      <p className="profile-bio">{merged.bio}</p>

      {waDigits && (
        <a
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-whatsapp"
        >
          💬 تواصل واتساب
        </a>
      )}

      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{lessonCount}</span>
          <span className="stat-label">درساً مسجّلاً</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{teacher.liveSessions.length}</span>
          <span className="stat-label">حصص مباشرة</span>
        </div>
        <div className="stat-box">
          <span className="stat-value stat-rating">
            {teacher.rating}
            <Stars rating={teacher.rating} />
          </span>
          <span className="stat-label">{teacher.ratingCount} تقييماً</span>
        </div>
      </div>
    </section>
  );
}
