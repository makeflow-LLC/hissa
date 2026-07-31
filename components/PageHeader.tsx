import Link from "next/link";

/**
 * رأس صفحة موحّد: زر رجوع دائم + عنوان + وصف + أوامر.
 *
 * كان كل صفحة ترسم رجوعها بطريقتها — رابط نصّي صغير بمسمّى مختلف وموضع
 * مختلف. التوحيد يجعل المستخدم يتعلّم مكان الرجوع مرّة واحدة، والزر
 * دائري واسع يسهل ضغطه بالإبهام لا كلمة صغيرة.
 */
export default function PageHeader({
  backHref,
  backLabel,
  emoji,
  title,
  subtitle,
  actions,
}: {
  /** إلى أين يرجع — دائماً محدّد، فلا نعتمد على زر المتصفّح وحده */
  backHref: string;
  backLabel: string;
  emoji?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-top">
        <Link href={backHref} className="back-btn" aria-label={`رجوع إلى ${backLabel}`}>
          <span aria-hidden="true">→</span>
        </Link>
        <div className="page-header-titles">
          <span className="page-header-back-label">{backLabel}</span>
          <h1 className="page-header-title">
            {emoji && <span aria-hidden="true">{emoji} </span>}
            {title}
          </h1>
        </div>
      </div>
      {subtitle && <p className="page-header-sub">{subtitle}</p>}
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
