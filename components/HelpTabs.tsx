"use client";

import { useState } from "react";

export interface HelpEntry {
  q: string;
  a: React.ReactNode;
}

/**
 * دليل الاستخدام: تبويبان (طالب / معلّم) وأسئلة مطويّة.
 *
 * مطويّة عمداً: صفحة مساعدة تعرض عشرين فقرة دفعةً واحدة لا تُقرأ. العناوين
 * وحدها تُمسح بالعين، فيفتح القارئ ما يخصّه.
 */
export default function HelpTabs({
  student,
  teacher,
  initial = "student",
}: {
  student: HelpEntry[];
  teacher: HelpEntry[];
  initial?: "student" | "teacher";
}) {
  const [tab, setTab] = useState<"student" | "teacher">(initial);
  const [open, setOpen] = useState<string | null>(null);
  const entries = tab === "student" ? student : teacher;

  return (
    <div className="help">
      <div className="tabs" role="tablist" aria-label="دليل الاستخدام">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "student"}
          className={`tab ${tab === "student" ? "tab-active" : ""}`}
          onClick={() => {
            setTab("student");
            setOpen(null);
          }}
        >
          🎓 للطالب
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "teacher"}
          className={`tab ${tab === "teacher" ? "tab-active" : ""}`}
          onClick={() => {
            setTab("teacher");
            setOpen(null);
          }}
        >
          👩‍🏫 للمعلّم
        </button>
      </div>

      <ul className="help-list">
        {entries.map((e) => {
          const key = `${tab}:${e.q}`;
          const isOpen = open === key;
          return (
            <li key={key} className="help-item">
              <button
                type="button"
                className={`help-q ${isOpen ? "help-q-open" : ""}`}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : key)}
              >
                <span>{e.q}</span>
                <span className="help-caret" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && <div className="help-a">{e.a}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
