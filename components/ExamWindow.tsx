"use client";

import { useEffect, useState } from "react";
import { formatWindow } from "@/lib/examTime";

/**
 * عرض نافذة الاختبار بتوقيت المتصفّح.
 *
 * الخادم يعمل بتوقيت UTC، فلو صِيغَ التاريخ هناك لرأى المعلّم ساعةً غير
 * التي كتبها. الصياغة تجري بعد التركيب في المتصفّح، ويظهر قبلها نصّ محايد
 * حتى لا يختلف ما يرسله الخادم عمّا يرسمه العميل.
 */
export default function ExamWindow({
  opens,
  closes,
}: {
  opens: string | null;
  closes: string | null;
}) {
  const [label, setLabel] = useState("…");
  useEffect(() => {
    setLabel(formatWindow(opens, closes));
  }, [opens, closes]);
  return <>{label}</>;
}
