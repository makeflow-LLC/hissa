"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExam, type ExamActionState } from "@/app/actions/exams";
import Hint from "@/components/Hint";
import InfoTip from "@/components/InfoTip";
import type { Exam, StudentGroup } from "@/lib/data/types";

const initial: ExamActionState = { ok: false };

/**
 * تحويل الوقت المخزّن (UTC) إلى صيغة حقل datetime-local بتوقيت المتصفّح.
 *
 * يجري بعد التركيب لا أثناء العرض: الخادم يعمل بتوقيت UTC والمتصفّح
 * بتوقيت المستخدم، فحسابه في الطرفين يعطي نصّين مختلفين ويكسر الترطيب.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * تحويل ما كتبه المعلّم إلى لحظة مطلقة (ISO بأوفست) **في المتصفّح**.
 *
 * حقل `datetime-local` يعطي «2026-08-01T11:35» بلا منطقة زمنية، ومن يقرؤه
 * يفترض توقيته هو. فكان الخادم — ويعمل بـ UTC — يفهمها ١١:٣٥ UTC، ثم
 * يعيدها المتصفّح بتوقيت المعلّم فتظهر ١٤:٣٥ في غزة (UTC+3): ثلاث ساعات
 * تُضاف في كل حفظ. المتصفّح وحده يعرف منطقة المستخدم، فليحسبها هو.
 */
function toAbsolute(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function ExamForm({
  exam,
  groups,
  defaultGroupId,
}: {
  /** موجود عند التعديل، غائب عند الإنشاء */
  exam?: Exam;
  groups: StudentGroup[];
  /** مجموعة مختارة سلفاً حين يأتي المعلّم من لوحتها */
  defaultGroupId?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveExam, initial);

  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  useEffect(() => {
    setOpensAt(toLocalInput(exam?.opens_at ?? null));
    setClosesAt(toLocalInput(exam?.closes_at ?? null));
  }, [exam?.opens_at, exam?.closes_at]);

  // بعد الإنشاء ينتقل المعلّم فوراً إلى صفحة كتابة الأسئلة
  useEffect(() => {
    if (state.ok && state.examId && !exam) {
      router.push(`/teacher/me/exams/${state.examId}`);
    }
  }, [state.ok, state.examId, exam, router]);

  if (groups.length === 0) {
    return (
      <p className="drafts-empty">
        الاختبار يوجَّه إلى مجموعة، ولا مجموعات لديك بعد. أنشئ مجموعة من صفحة{" "}
        <strong>طلابي</strong> وضَع فيها طلابك، ثم عُد لإنشاء الاختبار.
      </p>
    );
  }

  return (
    <form action={action} className="exam-form">
      {exam && <input type="hidden" name="examId" value={exam.id} />}

      <label className="form-field">
        <span className="form-label">عنوان الاختبار *</span>
        <input
          type="text"
          name="title"
          className="search-input"
          defaultValue={exam?.title ?? ""}
          placeholder="مثال: اختبار الوحدة الثانية — المعادلات"
          maxLength={150}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">تعليمات للطالب</span>
        <textarea
          name="description"
          className="search-input"
          rows={3}
          defaultValue={exam?.description ?? ""}
          placeholder="ما يحتاج الطالب معرفته قبل البدء: عدد الأسئلة، ما يُسمح باستخدامه…"
          maxLength={600}
        />
      </label>

      <label className="form-field">
        <span className="form-label">المجموعة المستهدفة *</span>
        <Hint>
          طلاب هذه المجموعة وحدهم يرون الاختبار ويقدّمونه. غيرهم لا يعلم بوجوده
          أصلاً.
        </Hint>
        <select
          name="groupId"
          defaultValue={
            exam?.group_id ??
            (groups.some((g) => g.id === defaultGroupId) ? defaultGroupId : "") ??
            ""
          }
          required
        >
          <option value="" disabled>
            — اختر مجموعة —
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.memberCount} طالباً)
            </option>
          ))}
        </select>
      </label>

      <div className="form-field">
        <span className="form-label">وقت التقديم</span>
        <Hint>
          اتركهما فارغين ليبقى الاختبار مفتوحاً بلا حدّ. الوقت يُفحص على الخادم،
          فلا ينفع تغيير ساعة الجهاز.
        </Hint>
        {/*
          الحقلان المرئيّان بلا `name`: ما يُرسَل هو الحقلان المخفيّان
          باللحظة المطلقة، وقد حُسبت في المتصفّح حيث تُعرف منطقة المعلّم.
        */}
        <input type="hidden" name="opensAt" value={toAbsolute(opensAt)} />
        <input type="hidden" name="closesAt" value={toAbsolute(closesAt)} />
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">يفتح في</span>
            <input
              type="datetime-local"
              className="search-input"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">يغلق في</span>
            <input
              type="datetime-local"
              className="search-input"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </label>
        </div>
        {(opensAt || closesAt) && (
          <p className="form-hint">
            🕒 بتوقيت جهازك:{" "}
            {opensAt ? `يفتح ${new Date(opensAt).toLocaleString("ar-EG")}` : "مفتوح الآن"}
            {closesAt ? ` · يغلق ${new Date(closesAt).toLocaleString("ar-EG")}` : ""}
          </p>
        )}
      </div>

      <div className="form-row">
        <label className="form-field">
          <span className="form-label">مدّة الإجابة بالدقائق</span>
          <input
            type="number"
            name="duration"
            className="search-input"
            min={1}
            max={600}
            defaultValue={exam?.duration_minutes ?? ""}
            placeholder="اتركه فارغاً لبلا حدّ"
          />
        </label>
        <label className="form-field">
          <span className="form-label">
            الاختبار من كم علامة؟
            <InfoTip>
              اكتب العلامة الكلّية التي تقصدها — مثلاً ١٠. تُقارَن بمجموع علامات
              أسئلتك ويُنبَّهك إن اختلفا، فلا تكتشف أن الاختبار من ٨ بعد أن
              يقدّمه طلابك. اتركه فارغاً إن لم ترد سقفاً محدّداً.
            </InfoTip>
          </span>
          <input
            type="number"
            name="targetPoints"
            className="search-input"
            min={1}
            max={1000}
            step={0.25}
            defaultValue={exam?.target_points ?? ""}
            placeholder="مثال: 10"
          />
        </label>
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "…جارٍ الحفظ" : exam ? "💾 حفظ التعديلات" : "➕ أنشئ الاختبار"}
        </button>
      </div>

      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
