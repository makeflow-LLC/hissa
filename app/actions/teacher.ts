"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

const STAGES = ["ابتدائي", "إعدادي", "ثانوي"] as const;

const GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)",
];

export interface TeacherFormState {
  ok: boolean;
  message?: string;
  slug?: string;
}

/** حروف أولية عربية من الاسم (أول حرف من أول كلمتين بعد اللقب) */
function initialsOf(name: string): string {
  const parts = name
    .replace(/^أ\.?\s*/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] ?? "م") + (parts[1]?.[0] ?? "");
}

// مسارات محجوزة لا يجوز أن تكون slug معلّم (تتعارض مع صفحات ثابتة تحت /teacher)
const RESERVED_SLUGS = new Set(["join", "onboarding", "me", "login", "new", "edit"]);

/** معرّف رابط نظيف: من المعرّف المطلوب أو مولّد عشوائياً */
function normalizeSlug(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (clean.length >= 3 && clean.length <= 40 && !RESERVED_SLUGS.has(clean)) {
    return clean;
  }
  return `m-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * إنشاء أو تحديث بروفايل المعلّم المملوك للمستخدم الحالي.
 * يكتب في جدول teachers الحقيقي (سياسة owner_id = auth.uid())، فيظهر
 * البروفايل في الدليل وصفحته العامة فور الحفظ.
 */
export async function saveTeacherProfile(
  _prev: TeacherFormState,
  formData: FormData
): Promise<TeacherFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const qualification = String(formData.get("qualification") ?? "").trim();
  // تُعرض للطالب قبل إرسال طلب الانضمام — نص صِرف لا HTML
  const joinInstructions = stripTags(
    String(formData.get("join_instructions") ?? "")
  ).slice(0, 800);
  const experience = Math.max(
    0,
    Math.min(60, parseInt(String(formData.get("experience_years") ?? "0"), 10) || 0)
  );
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const avatar = String(formData.get("avatar") ?? "").trim() || null;
  const stages = STAGES.filter((s) => formData.get(`stage_${s}`) === "on");
  const wantedSlug = String(formData.get("slug") ?? "").trim();

  if (!name || !subject || stages.length === 0) {
    return {
      ok: false,
      message: "الاسم والمادة ومرحلة واحدة على الأقل حقول مطلوبة.",
    };
  }

  // صف المعلّم الحالي إن وُجد (تحديث) أو إنشاء جديد
  const { data: existing } = await supabase
    .from("teachers")
    .select("id, slug, gradient")
    .eq("owner_id", user.id)
    .maybeSingle();

  const payload = {
    owner_id: user.id,
    name,
    subject,
    stages,
    bio,
    join_instructions: joinInstructions,
    qualification,
    experience_years: experience,
    whatsapp,
    avatar_url: avatar,
    initials: initialsOf(name),
    is_published: true,
  };

  if (existing) {
    const { error } = await supabase
      .from("teachers")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { ok: false, message: "تعذّر حفظ التعديلات — حاول مجدداً." };
    await supabase.from("profiles").update({ role: "teacher" }).eq("id", user.id);
    revalidatePath(`/teacher/${existing.slug}`);
    revalidatePath("/");
    revalidatePath("/teacher/me");
    return { ok: true, slug: existing.slug };
  }

  // البريد الواحد إمّا معلّم وإمّا طالب: حساب استُخدم فعلاً كطالب
  // (تسجيل في حصة أو متابعة معلّم أو تقدّم محفوظ) لا يُحوَّل إلى معلّم.
  const [enr, fol, prog] = await Promise.all([
    supabase
      .from("enrollments")
      .select("session_id", { count: "exact", head: true })
      .eq("student_id", user.id),
    supabase
      .from("follows")
      .select("teacher_id", { count: "exact", head: true })
      .eq("student_id", user.id),
    supabase
      .from("lesson_progress")
      .select("lesson_id", { count: "exact", head: true })
      .eq("student_id", user.id),
  ]);
  if ((enr.count ?? 0) + (fol.count ?? 0) + (prog.count ?? 0) > 0) {
    return {
      ok: false,
      message:
        "هذا البريد مستخدَم كحساب طالب على المنصة. لفتح حساب معلّم سجّل الخروج واستخدم بريداً آخر.",
    };
  }

  // إنشاء: نولّد slug فريداً (نعيد المحاولة عند التعارض)
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
  let slug = normalizeSlug(wantedSlug || name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("teachers")
      .insert({ ...payload, slug, gradient, rating: 5.0, rating_count: 0 });
    if (!error) {
      await supabase.from("profiles").update({ role: "teacher" }).eq("id", user.id);
      revalidatePath("/");
      return { ok: true, slug };
    }
    // 23505 = تعارض فريد على slug
    if (error.code === "23505") {
      slug = `${normalizeSlug(wantedSlug || name)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      continue;
    }
    return { ok: false, message: "تعذّر إنشاء البروفايل — حاول مجدداً." };
  }
  return { ok: false, message: "تعذّر توليد رابط فريد — جرّب معرّفاً آخر." };
}

/** إخفاء/إظهار البروفايل عن الدليل */
export async function toggleTeacherPublished(published: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("teachers")
    .update({ is_published: published })
    .eq("owner_id", user.id);
  revalidatePath("/");
  revalidatePath("/teacher/me");
}

/** توجيه بعد الحفظ إلى بروفايل المعلّم العام */
export async function goToMyProfile(slug: string): Promise<never> {
  redirect(`/teacher/${slug}`);
}

/**
 * حالة توفّر المعلّم للردّ.
 *
 * الطالب يرسل سؤاله ثم لا يدري أينتظر دقيقة أم يوماً. سطر يكتبه المعلّم
 * مرّةً («أعود بعد المغرب») أرحم من صمتٍ يُفسَّر إهمالاً.
 */
export async function setAvailability(
  status: "available" | "busy" | "offline",
  note = ""
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  if (!["available", "busy", "offline"].includes(status)) {
    return { ok: false, message: "حالة غير معروفة." };
  }

  const { data: changed, error } = await supabase
    .from("teachers")
    .update({
      availability: status,
      availability_note: stripTags(note).trim().slice(0, 120),
      availability_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .select("slug");

  if (error) return { ok: false, message: "تعذّر حفظ الحالة." };
  if (!changed || changed.length === 0) {
    return { ok: false, message: "لا بروفايل معلّم على هذا الحساب." };
  }

  revalidatePath("/teacher/me");
  revalidatePath(`/teacher/${(changed[0] as { slug: string }).slug}`);
  return { ok: true, message: "حُدّثت حالتك." };
}
