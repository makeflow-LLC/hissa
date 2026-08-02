import type { LeaderRow } from "@/lib/data/queries";

const MEDAL = ["🥇", "🥈", "🥉"];

/** ترتيب أفضل النتائج في نشاط — يُعرض إن أذن به المعلّم */
export default function ActivityLeaderboard({
  rows,
  meId,
}: {
  rows: LeaderRow[];
  /** لإبراز صفّ القارئ نفسه بين الصفوف */
  meId?: string;
}) {
  if (rows.length === 0) {
    return <p className="drafts-empty">لا نتائج بعد — كن أوّل من يلعب!</p>;
  }

  return (
    <ol className="leaderboard">
      {rows.map((r, i) => (
        <li
          key={r.studentId}
          className={`leader-row ${r.studentId === meId ? "leader-me" : ""}`}
        >
          <span className="leader-rank">{MEDAL[i] ?? i + 1}</span>
          <span className="leader-name">
            {r.name}
            {r.studentId === meId && <span className="group-meta"> (أنت)</span>}
          </span>
          <span className="leader-score">
            {r.best} من {r.total}
          </span>
          <span className="group-meta">{r.plays} محاولة</span>
        </li>
      ))}
    </ol>
  );
}
