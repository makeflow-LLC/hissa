"use client";

import { useState } from "react";

/**
 * إطارٌ مقاسه **مقاس الصورة المعروضة بالضبط** — تُرسم عليه النقاط بالنسب.
 *
 * المحاولتان السابقتان فشلتا لأنهما اعتمدتا على «الالتفاف حول المحتوى»
 * (`fit-content` ثم `inline-block`) مع `max-width: 100%` على الصورة:
 * وهذا اعتمادٌ دائريّ — عرض الإطار يُشتقّ من الصورة وعرض الصورة يُشتقّ
 * من الإطار — وينهار في المتصفّح إلى **صفر** داخل عمودٍ مرن. والنتيجة:
 * صورةٌ غير مرئية، وضغطُ المعلّم لا يقع على شيء، فلا تُحفظ إحداثيات
 * وتتكدّس كل النقاط في منتصف الصورة عند اللعب.
 *
 * والحلّ قطعُ الدائرة: نقرأ أبعاد الصورة الطبيعية عند تحميلها، ثم نمنح
 * الإطار عرضاً **محدَّداً** = أصغرَ من عرض الحاوية ومن (نسبة العرض إلى
 * الارتفاع × أقصى ارتفاع). فيصير المقاس معلوماً بلا رجوعٍ إلى المحتوى،
 * ويطابق مستطيلُ الإطار مستطيلَ الصورة تماماً.
 */
export default function ImageFrame({
  src,
  className,
  maxVh = 50,
  onClick,
  frameRef,
  children,
}: {
  src: string;
  className?: string;
  /** أقصى ارتفاع بوحدة vh — الصورة والدرج يجب أن يظهرا معاً */
  maxVh?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  frameRef?: React.Ref<HTMLDivElement>;
  /** النقاط — أبناء الإطار، مواضعها نِسَبٌ منه */
  children?: React.ReactNode;
}) {
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <div
      ref={frameRef}
      className={`img-frame ${className ?? ""}`}
      onClick={onClick}
      style={
        ratio
          ? { aspectRatio: String(ratio), width: `min(100%, ${ratio * maxVh}vh)` }
          : { width: "100%" }
      }
    >
      {/*
        `ref` مع `onLoad` معاً: الصورة المخزَّنة في ذاكرة المتصفّح تكتمل
        **قبل** أن يربط React المستمع، فلا يقع `onLoad` أبداً ويبقى المقاس
        على الاحتياطيّ — وهو ما يجعل الإطار يبدو سليماً أوّل مرّة ومعطوباً
        عند العودة إلى الصفحة.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) {
            setRatio(el.naturalWidth / el.naturalHeight);
          }
        }}
        src={src}
        alt=""
        className="img-frame-img"
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth > 0 && el.naturalHeight > 0) {
            setRatio(el.naturalWidth / el.naturalHeight);
          }
        }}
      />
      {children}
    </div>
  );
}
