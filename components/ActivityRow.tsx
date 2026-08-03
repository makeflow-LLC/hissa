"use client";

import Link from "next/link";
import { useState } from "react";
import ActivityRowActions from "@/components/ActivityRowActions";

/**
 * صفّ النشاط في القائمة — **عميلٌ لأنه يُخفي نفسه فور الحذف**.
 *
 * كان الحذف يعتمد على `router.refresh()` وحده ليختفي الصفّ: يُحذف الصفّ من
 * قاعدة البيانات فعلاً، ثم تبقى الشاشة كما هي حتى تصل صفحةٌ جديدة من
 * الخادم — فيبدو للمعلّم أن الزرّ لا يعمل، فيضغط ثانيةً وثالثة. والاختفاء
 * الفوريّ هنا لا يُغني عن التحديث بل يسبقه: الحقيقة من الخادم تصل بعد
 * لحظة وتؤكّد ما رآه.
 */
export default function ActivityRow({
  activityId,
  title,
  side,
  children,
}: {
  activityId: string;
  title: string;
  /** شارة الحالة — تُبنى في الخادم */
  side: React.ReactNode;
  children: React.ReactNode;
}) {
  const [gone, setGone] = useState(false);
  if (gone) return null;

  return (
    <li className="exam-card">
      {children}
      <div className="exam-card-side">
        {side}
        <div className="card-actions">
          <Link
            href={`/teacher/me/activities/${activityId}`}
            className="btn btn-outline btn-sm"
          >
            ✏️ تعديل
          </Link>
          <ActivityRowActions
            activityId={activityId}
            title={title}
            onDeleted={() => setGone(true)}
          />
        </div>
      </div>
    </li>
  );
}
