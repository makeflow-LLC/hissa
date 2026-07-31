/**
 * سطر تعريفي قصير تحت عنوان القسم أو فوق الخيار.
 *
 * اللوحتان تعرضان خيارات كثيرة لا يشرح اسمُها وحده لماذا هي موجودة —
 * «منح صلاحية»، «مجموعة»، «بطاقة تقييم». جملة واحدة تحت كل عنوان أرخص
 * من دليل استخدام لا يقرؤه أحد.
 */
export default function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="hint">
      <span aria-hidden="true">💡</span> {children}
    </p>
  );
}
