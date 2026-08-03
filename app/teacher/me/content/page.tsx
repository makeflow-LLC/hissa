import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getMyTeacher,
  getMyTeacherContent,
} from "@/lib/data/queries";
import {
  deleteUnit,
  deleteLesson,
  moveUnit,
  moveLesson,
} from "@/app/actions/teacher-content";
import AddUnitForm from "@/components/AddUnitForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "إدارة المحتوى | منصة حصة" };

export default async function TeacherContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/content");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  const content = await getMyTeacherContent();
  const units = content?.units ?? [];

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="🎬"
        title="إدارة المحتوى"
        subtitle="أضِف الوحدات والدروس — تظهر مباشرةً في صفحتك العامة للطلاب."
        actions={
          <>
            <Link href="/teacher/me/lessons/design" className="btn btn-primary">
              ✨ صمّم درساً
            </Link>
            <Link href="/teacher/me/lessons/new" className="btn btn-outline">
              ➕ درس فارغ
            </Link>
          </>
        }
      />

      {/* الوحدات والدروس */}
      <section className="dashboard-section">
        <h2 className="section-title">📚 الوحدات والدروس</h2>

        <AddUnitForm />

        {units.length === 0 ? (
          <p className="drafts-empty">
            لا توجد وحدات بعد. أنشئ وحدة أولاً، ثم أضِف دروساً إليها.
          </p>
        ) : (
          <div className="unit-manage-list">
            {units.map((u, ui) => (
              <article key={u.id} className="unit-manage-card">
                <header className="unit-manage-head">
                  <div>
                    <h3 className="unit-manage-title">{u.title}</h3>
                    {u.description && (
                      <p className="unit-manage-desc">{u.description}</p>
                    )}
                  </div>
                  <div className="reorder-group">
                    <form action={moveUnit}>
                      <input type="hidden" name="unitId" value={u.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        className="btn btn-outline btn-sm"
                        disabled={ui === 0}
                        aria-label={`تحريك ${u.title} لأعلى`}
                        title="لأعلى"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveUnit}>
                      <input type="hidden" name="unitId" value={u.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className="btn btn-outline btn-sm"
                        disabled={ui === units.length - 1}
                        aria-label={`تحريك ${u.title} لأسفل`}
                        title="لأسفل"
                      >
                        ▼
                      </button>
                    </form>
                    <form action={deleteUnit}>
                      <input type="hidden" name="unitId" value={u.id} />
                      <button
                        type="submit"
                        className="btn btn-outline btn-sm btn-danger"
                      >
                        🗑 حذف الوحدة
                      </button>
                    </form>
                  </div>
                </header>

                {u.lessons.length === 0 ? (
                  <p className="drafts-empty">لا دروس في هذه الوحدة بعد.</p>
                ) : (
                  <ul className="lesson-manage-list">
                    {u.lessons.map((l, li) => (
                      <li key={l.id} className="lesson-manage-row">
                        <span className="lesson-manage-emoji" aria-hidden="true">
                          {l.emoji}
                        </span>
                        <span className="lesson-manage-body">
                          <span className="lesson-manage-title">{l.title}</span>
                          <span className="lesson-manage-meta">
                            {l.duration && <>⏱ {l.duration} · </>}
                            {l.status === "draft" ? (
                              <span className="pill pill-draft">مسودّة</span>
                            ) : (
                              <span className="pill pill-live">منشور</span>
                            )}
                            {l.is_free_preview && (
                              <span className="pill pill-free">🎁 عيّنة مجانية</span>
                            )}
                          </span>
                        </span>
                        <span className="lesson-manage-actions">
                          <form action={moveLesson}>
                            <input type="hidden" name="lessonId" value={l.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              className="btn btn-outline btn-sm"
                              disabled={li === 0}
                              aria-label={`تحريك ${l.title} لأعلى`}
                              title="لأعلى"
                            >
                              ▲
                            </button>
                          </form>
                          <form action={moveLesson}>
                            <input type="hidden" name="lessonId" value={l.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              className="btn btn-outline btn-sm"
                              disabled={li === u.lessons.length - 1}
                              aria-label={`تحريك ${l.title} لأسفل`}
                              title="لأسفل"
                            >
                              ▼
                            </button>
                          </form>
                          <Link
                            href={`/teacher/me/lessons/${l.id}`}
                            className="btn btn-outline btn-sm"
                          >
                            ✏️ تعديل
                          </Link>
                          <form action={deleteLesson}>
                            <input type="hidden" name="lessonId" value={l.id} />
                            <button
                              type="submit"
                              className="btn btn-outline btn-sm btn-danger"
                              aria-label="حذف الدرس"
                            >
                              🗑
                            </button>
                          </form>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href={`/teacher/me/lessons/new?unit=${u.id}`}
                  className="btn btn-outline btn-sm add-lesson-btn"
                >
                  ➕ أضِف درساً إلى {u.title}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="content-foot-hint">
        👁 عاين النتيجة في{" "}
        <Link href={`/teacher/${teacher.slug}`} className="back-link">
          بروفايلك العام
        </Link>
        .
      </p>
    </main>
  );
}
