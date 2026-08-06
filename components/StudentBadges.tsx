import type { StudentStats } from "@/lib/data/queries";

/**
 * شارات الطالب ونقاطه.
 *
 * **مشتقّة من نشاطه لا من سجلٍّ يُكتب** (`student_points` في 0029): لا
 * جدول نقاطٍ يمكن العبث به، ولا مزامنة تتأخّر عن الواقع.
 *
 * والشارات مربوطةٌ بالإتقان والمواظبة — مراجعةٌ تمّت، واجبٌ في موعده،
 * سلسلة أيام — لا بعدد النقرات: نقاطٌ تكافئ الحركة وحدها تجعل الطالب
 * يفتح الدروس ليجمع لا ليتعلّم.
 */
export default function StudentBadges({ stats }: { stats: StudentStats }) {
  const badges = [
    stats.streakDays >= 7 && { icon: "🔥", label: `${stats.streakDays} أيام متتالية` },
    stats.streakDays >= 3 && stats.streakDays < 7 && { icon: "🔥", label: `${stats.streakDays} أيام متتالية` },
    stats.lessonsDone >= 10 && { icon: "📚", label: "أنهى ١٠ دروس" },
    stats.lessonsDone >= 25 && { icon: "🎓", label: "أنهى ٢٥ درساً" },
    stats.reviewsDone >= 5 && { icon: "🔁", label: "مراجعٌ مواظب" },
    stats.reviewsDone >= 20 && { icon: "🧠", label: "ذاكرةٌ راسخة" },
    stats.onTime >= 5 && { icon: "⏰", label: "يسلّم في موعده" },
    stats.examsDone >= 5 && { icon: "📝", label: "خاض ٥ اختبارات" },
    stats.activities >= 20 && { icon: "🎮", label: "٢٠ نشاطاً" },
  ].filter(Boolean) as { icon: string; label: string }[];

  return (
    <section className="dashboard-section">
      <h2 className="section-title">🏅 رحلتك</h2>
      <div className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{stats.points}</span>
          <span className="stat-label">نقطة</span>
        </div>
        <div className="stat-box">
          <span className={`stat-value ${stats.streakDays === 0 ? "stat-value-muted" : ""}`}>
            {stats.streakDays > 0 ? `🔥 ${stats.streakDays}` : "—"}
          </span>
          <span className="stat-label">أيام متتالية</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{stats.activeDays}</span>
          <span className="stat-label">يوم نشاط</span>
        </div>
      </div>

      {badges.length > 0 && (
        <ul className="badge-row">
          {badges.map((b) => (
            <li key={b.label} className="badge-chip">
              <span aria-hidden="true">{b.icon}</span> {b.label}
            </li>
          ))}
        </ul>
      )}

      <p className="form-hint">
        النقاط تشجيعٌ لك وحدك — لا تدخل في علاماتك ولا يراها أحد غيرك.
        وأثقلها للمراجعة والواجب في موعده، لا لعدد ما تفتحه.
      </p>
    </section>
  );
}
