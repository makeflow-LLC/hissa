"use client";

import { useActionState, useState } from "react";
import { saveReview, type ReviewState } from "@/app/actions/review";
import type { PublicReview } from "@/lib/data/types";

const initialState: ReviewState = { ok: false };

function StarsRow({ value }: { value: number }) {
  return (
    <span className="review-stars" aria-label={`${value} من ٥`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= value ? "star-on" : "star-off"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * تقييمات المعلّم: قائمة ما كتبه الطلاب + نموذج للطالب المؤهّل.
 * «مؤهّل» = أنجز درساً واحداً على الأقل من دروس هذا المعلّم — والشرط
 * مفروض في قاعدة البيانات لا في الواجهة فقط.
 */
export default function ReviewSection({
  teacherId,
  teacherSlug,
  reviews,
  myReview,
  canReview,
  isAuthed,
}: {
  teacherId: string;
  teacherSlug: string;
  reviews: PublicReview[];
  myReview: { rating: number; comment: string } | null;
  canReview: boolean;
  isAuthed: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveReview, initialState);
  const [rating, setRating] = useState(myReview?.rating ?? 0);

  return (
    <section className="dashboard-section">
      <h2 className="section-title">⭐ تقييمات الطلاب</h2>

      {canReview ? (
        <form action={formAction} className="review-form">
          <input type="hidden" name="teacherId" value={teacherId} />
          <input type="hidden" name="teacherSlug" value={teacherSlug} />
          <input type="hidden" name="rating" value={rating} />

          <div className="form-field">
            <span className="form-label">
              {myReview ? "عدّل تقييمك" : "كيف تقيّم هذا المعلّم؟"}
            </span>
            <div className="star-picker" role="group" aria-label="اختر التقييم">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`star-btn ${n <= rating ? "star-on" : "star-off"}`}
                  onClick={() => setRating(n)}
                  aria-label={`${n} نجوم`}
                  aria-pressed={rating === n}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="form-field">
            <span className="form-label">تعليقك (اختياري)</span>
            <textarea
              name="comment"
              className="search-input form-textarea"
              rows={2}
              maxLength={600}
              defaultValue={myReview?.comment ?? ""}
              placeholder="ما الذي أعجبك في شرحه؟"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "جارٍ الحفظ…" : myReview ? "حفظ التعديل" : "أرسل التقييم"}
          </button>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
          )}
        </form>
      ) : (
        isAuthed && (
          <p className="form-hint review-eligibility">
            💡 التقييم لطلاب الصف: انضمّ إلى هذا المعلّم وانتظر قبوله، ثم يمكنك
            تقييمه. المتابعة وحدها لا تكفي.
          </p>
        )
      )}

      {reviews.length === 0 ? (
        <p className="drafts-empty">لا توجد تقييمات بعد — كن أول من يقيّم.</p>
      ) : (
        <ul className="reviews-list">
          {reviews.map((r) => (
            <li key={r.id} className="review-row">
              <div className="review-head">
                <strong className="review-author">{r.studentName}</strong>
                <StarsRow value={r.rating} />
                <span className="message-date">
                  {new Date(r.created_at).toLocaleDateString("ar-EG", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              {r.comment && <p className="review-comment">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
