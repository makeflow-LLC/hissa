"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveActivity,
  saveActivityTemplate,
  deleteActivityTemplate,
  type ActivityActionState,
} from "@/app/actions/activities";
import InfoTip from "@/components/InfoTip";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import {
  BUILTIN_ACTIVITY_TEMPLATES,
  KINDS,
  activityProblem,
  cleanItems,
  kindSpec,
  type ActivityItem,
  type ActivityKind,
  type ActivityTemplate,
} from "@/lib/activityKinds";
import type { Activity, StudentGroup } from "@/lib/data/types";

const initial: ActivityActionState = { ok: false };

/**
 * محرّر النشاط.
 *
 * **تبديل اللعبة لا يمسّ المحتوى**: العناصر أزواجٌ محايدة، وما يتغيّر هو
 * عنوان العمودين وكيف يُلعبان. فالمعلّم يكتب مفرداته مرّةً ثم يجرّبها
 * مطابقةً وبطاقاتٍ واختياراً سريعاً بضغطة زرّ.
 */
export default function ActivityBuilder({
  activity,
  groups,
  lessons,
  myTemplates,
}: {
  activity?: Activity;
  groups: StudentGroup[];
  lessons: { id: string; title: string }[];
  myTemplates: ActivityTemplate[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveActivity, initial);
  const [tplState, tplAction, tplPending] = useActionState(
    saveActivityTemplate,
    initial
  );

  const [kind, setKind] = useState<ActivityKind>(activity?.kind ?? "match");
  const [items, setItems] = useState<ActivityItem[]>(
    activity?.items?.length ? activity.items : Array.from({ length: 6 }, () => ({ a: "", b: "" }))
  );
  const [openTpl, setOpenTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  /** رقم الصفّ الذي تُرفع صورته الآن — لتعطيل زرّه وحده لا الجدول كلّه */
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const [imgErr, setImgErr] = useState("");

  const spec = kindSpec(kind);
  const payload = useMemo(() => JSON.stringify(items), [items]);
  const clean = useMemo(() => cleanItems(items, kind), [items, kind]);
  const problem = useMemo(() => activityProblem(kind, items), [kind, items]);

  // بعد الإنشاء ينتقل المعلّم إلى صفحة النشاط ليكمل عليه.
  // في تأثير لا في العرض: التوجيه أثناء الرسم أثرٌ جانبيّ يعيد React
  // تنفيذه ويحذّر منه.
  useEffect(() => {
    if (state.ok && state.activityId && !activity) {
      router.push(`/teacher/me/activities/${state.activityId}`);
    }
  }, [state.ok, state.activityId, activity, router]);

  function patch(i: number, next: Partial<ActivityItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...next } : it)));
  }

  /**
   * رفع صورة الصفّ إلى مجلد المعلّم في حاوية `lesson-media` — نفس مسار
   * صور الدروس وسياستها. تُصغَّر في المتصفّح قبل الرفع: صورة الكاميرا
   * عدّة ميجابايت، ورفعها كما هي يُبطئ الإدخال واللعب معاً.
   */
  async function uploadImage(i: number, file: File | undefined) {
    if (!file) return;
    setImgErr("");
    if (!file.type.startsWith("image/")) {
      setImgErr("اختر ملفّ صورة.");
      return;
    }
    setImgBusy(i);
    try {
      const blob = await shrinkImage(file, 900, 0.82);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("انتهت الجلسة — سجّل الدخول مجدداً.");

      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("lesson-media")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("lesson-media").getPublicUrl(path);
      patch(i, { img: publicUrl });
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
    } finally {
      setImgBusy(null);
    }
  }

  const templates: ActivityTemplate[] = [
    ...myTemplates.map((t) => ({ ...t, builtin: false })),
    ...BUILTIN_ACTIVITY_TEMPLATES,
  ];

  return (
    <div className="activity-builder">
      <form action={action} className="exam-form">
        {activity && <input type="hidden" name="activityId" value={activity.id} />}
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="items" value={payload} />

        <label className="form-field">
          <span className="form-label">عنوان النشاط *</span>
          <input
            type="text"
            name="title"
            className="search-input"
            defaultValue={activity?.title ?? ""}
            placeholder="مثال: مراجعة مفردات الوحدة الثانية"
            maxLength={150}
            required
          />
        </label>

        {/* ===== اختيار اللعبة ===== */}
        <div className="form-field">
          <span className="form-label">
            نوع اللعبة
            <InfoTip>
              المحتوى واحد واللعبة تتبدّل: اكتب أزواجك مرّةً ثم جرّبها في أي
              لعبة بضغطة — لا يُعاد إدخال شيء.
            </InfoTip>
          </span>
          <div className="kind-grid" role="radiogroup" aria-label="نوع اللعبة">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                className={`kind-chip ${kind === k.value ? "kind-chip-on" : ""}`}
                onClick={() => setKind(k.value)}
              >
                <span className="kind-icon" aria-hidden="true">
                  {k.icon}
                </span>
                {k.label}
              </button>
            ))}
          </div>
          <p className="hint">{spec.about}</p>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">
              من يلعبه؟
              <InfoTip>
                مجموعة بعينها، أو كل طلابك المنضمّين. النشاط تدريبٌ لا امتحان،
                فتوسيعه على الجميع لا يضرّ.
              </InfoTip>
            </span>
            <select name="groupId" defaultValue={activity?.group_id ?? ""}>
              <option value="">كل طلابي المنضمّين</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount} طالباً)
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">مرتبط بدرس (اختياري)</span>
            <select name="lessonId" defaultValue={activity?.lesson_id ?? ""}>
              <option value="">— بلا درس —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="stage-option leaderboard-toggle">
          <input
            type="checkbox"
            name="showLeaderboard"
            defaultChecked={activity ? activity.show_leaderboard : true}
          />
          <span>
            🏆 أظهر لوحة الصدارة للطلاب
            <InfoTip>
              ترتيب أفضل النتائج بين من لعبوا. المنافسة تدفع التكرار، والتكرار
              هو التدريب — لكن صفّاً فيه متعثّر يرى اسمه آخر القائمة كل مرّة قد
              ينفر، فالخيار لك.
            </InfoTip>
          </span>
        </label>

        <label className="form-field">
          <span className="form-label">تعليمات للطالب (اختياري)</span>
          <input
            type="text"
            name="instructions"
            className="search-input"
            defaultValue={activity?.instructions ?? ""}
            placeholder="مثال: راجع المفردات قبل اختبار الأحد"
            maxLength={500}
          />
        </label>

        {/* ===== العناصر ===== */}
        <div className="form-field">
          <div className="section-head-row">
            <span className="form-label">
              المحتوى — {clean.length} عنصراً صالحاً
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setOpenTpl((v) => !v)}
            >
              📄 قوالب
            </button>
          </div>

          {openTpl && (
            <ul className="template-list">
              {templates.map((t) => (
                <li key={t.id} className="template-row">
                  <div className="template-info">
                    <strong className="template-name">
                      {t.builtin ? "📘 " : "⭐ "}
                      {t.name}
                    </strong>
                    <span className="group-meta">
                      {kindSpec(t.kind).label} · {t.items.length} عنصراً
                    </span>
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (
                          clean.length > 0 &&
                          !window.confirm(`سيستبدل القالب «${t.name}» ما كتبتَه. متأكّد؟`)
                        )
                          return;
                        setKind(t.kind);
                        setItems(
                          t.items.length
                            ? t.items.map((i) => ({ ...i }))
                            : Array.from({ length: 6 }, () => ({ a: "", b: "" }))
                        );
                        setOpenTpl(false);
                      }}
                    >
                      استخدام
                    </button>
                    {!t.builtin && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-danger"
                        onClick={async () => {
                          if (!window.confirm(`حذف قالب «${t.name}»؟`)) return;
                          await deleteActivityTemplate(t.id);
                          router.refresh();
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <table className="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{spec.labelA}</th>
                <th>{spec.labelB}</th>
                {spec.usesImages && <th>صورة</th>}
                <th aria-label="حذف" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="items-num">{i + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="search-input"
                      value={it.a}
                      maxLength={200}
                      placeholder={i === 0 ? spec.exampleA : ""}
                      onChange={(e) => patch(i, { a: e.target.value })}
                      aria-label={`${spec.labelA} ${i + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="search-input"
                      value={it.b}
                      maxLength={200}
                      placeholder={i === 0 ? spec.exampleB : ""}
                      onChange={(e) => patch(i, { b: e.target.value })}
                      aria-label={`${spec.labelB} ${i + 1}`}
                    />
                  </td>
                  {spec.usesImages && (
                    <td>
                      {it.img ? (
                        <span className="item-img">
                          {/* عنصر <img> عاديّ: الصور من الحاوية بأبعاد متغيّرة
                              وهذه معاينةٌ صغيرة في المحرّر لا صفحة عامّة */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.img} alt="" className="item-img-thumb" />
                          <button
                            type="button"
                            className="btn btn-outline btn-sm btn-danger"
                            onClick={() => patch(i, { img: "" })}
                            aria-label={`إزالة صورة الصف ${i + 1}`}
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <label className="upload-box item-img-upload">
                          <input
                            type="file"
                            accept="image/*"
                            className="upload-input"
                            disabled={imgBusy !== null}
                            onChange={(e) => uploadImage(i, e.target.files?.[0])}
                          />
                          {imgBusy === i ? "⏳" : "🖼️ صورة"}
                        </label>
                      )}
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-danger"
                      onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                      aria-label={`حذف الصف ${i + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {imgErr && <p className="form-error">{imgErr}</p>}
          {spec.usesImages && (
            <p className="form-hint">
              🖼️ الصورة اختيارية لكل صفّ. الصفوف التي تحمل صورة تصير درجاتِ
              «ما الذي تراه؟» في الهرم، والباقي يتنوّع بين الاختيار والحكم
              وترتيب الحروف والكتابة.
            </p>
          )}

          <div className="card-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setItems((p) => [...p, { a: "", b: "" }])}
            >
              ➕ صفّ
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setItems((p) => [...p, ...Array.from({ length: 5 }, () => ({ a: "", b: "" }))])
              }
            >
              ➕ خمسة صفوف
            </button>
          </div>

          {problem && <p className="form-hint exam-problems">⚠ {problem}</p>}
        </div>

        <div className="card-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "…جارٍ الحفظ" : activity ? "💾 حفظ" : "➕ أنشئ النشاط"}
          </button>
        </div>

        {state.message && (
          <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
        )}
      </form>

      {/* حفظ المحتوى الحالي قالباً — نموذج مستقلّ لا متداخل */}
      <form action={tplAction} className="template-save">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="items" value={payload} />
        <input
          type="text"
          name="name"
          className="search-input"
          value={tplName}
          onChange={(e) => setTplName(e.target.value)}
          placeholder="احفظ هذا المحتوى قالباً — اكتب اسمه"
          maxLength={100}
        />
        <button
          type="submit"
          className="btn btn-outline btn-sm"
          disabled={tplPending || !tplName.trim()}
        >
          💾 حفظ قالباً
        </button>
        {tplState.message && (
          <p className={tplState.ok ? "form-ok" : "form-error"}>{tplState.message}</p>
        )}
      </form>
    </div>
  );
}
