"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface BookingState {
  ok: boolean;
  message?: string;
}

async function myTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, teacher: null, user: null };
  const { data } = await supabase
    .from("teachers")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, teacher: data as { id: string; slug: string } | null, user };
}

/**
 * قراءة لحظةٍ مطلقة.
 *
 * **يُرفض النصّ الذي لا منطقة زمنية له.** حقل `datetime-local` يعطي
 * «2026-08-20T17:00» فيفهمه الخادم — ويعمل بـ UTC — بتوقيته هو، فيُخزَّن
 * موعدٌ يخالف ما قصده المعلّم بثلاث ساعات في غزة. المتصفّح وحده يعرف
 * منطقة المستخدم فيحسبها ويرسلها ISO، والرفض هنا يمنع عودة الشكل القديم
 * صامتاً. (نفس درس نافذة الاختبارات والواجبات.)
 */
function absolute(raw: string): string | null {
  const s = raw.trim();
  if (!s || !/[Zz]|[+-]\d\d:?\d\d$/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * فتح مواعيد — دفعةً واحدة.
 *
 * المعلّم يفتح «الأحد والثلاثاء ٥ و٦ مساءً لأربعة أسابيع» لا موعداً
 * واحداً، فالواجهة تولّد اللحظات وترسلها مجموعةً. والتكرار يُطرح هنا لا
 * في القاعدة: موعدان في اللحظة نفسها ليسا خطأ يستحقّ قيداً فريداً (قد
 * يفتح المعلّم مجموعتين متوازيتين يوماً ما)، لكنّهما اليوم زلّة ضغطٍ
 * مكرّر لا نيّة.
 */
export async function saveSlots(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    return { ok: false, message: "تعذّرت قراءة المواعيد." };
  }
  if (!Array.isArray(raw) || raw.length === 0)
    return { ok: false, message: "لم تختر أي موعد بعد." };
  if (raw.length > 60)
    return { ok: false, message: "٦٠ موعداً في المرّة الواحدة حدٌّ كافٍ." };

  const minutes = Number(formData.get("minutes") ?? 60);
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 480)
    return { ok: false, message: "مدّة الحصّة بين ١٠ و٤٨٠ دقيقة." };

  const priceRaw = String(formData.get("price") ?? "").trim();
  let price: number | null = null;
  if (priceRaw) {
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100000)
      return { ok: false, message: "السعر رقمٌ موجب، أو اتركه فارغاً." };
    price = n;
  }
  const currency = String(formData.get("currency") ?? "ILS").trim().slice(0, 8) || "ILS";
  const note = stripTags(String(formData.get("note") ?? "")).trim().slice(0, 200);

  const now = Date.now();
  const instants: string[] = [];
  for (const v of raw) {
    const iso = absolute(String(v));
    if (!iso) return { ok: false, message: "أحد المواعيد غير صالح." };
    if (new Date(iso).getTime() <= now) continue; // ما مضى لا يُفتح
    if (!instants.includes(iso)) instants.push(iso);
  }
  if (instants.length === 0)
    return { ok: false, message: "كل المواعيد التي اخترتها قد مضت." };

  // لا نكرّر موعداً مفتوحاً أصلاً
  const { data: existing } = await supabase
    .from("availability_slots")
    .select("starts_at")
    .eq("teacher_id", teacher.id)
    .in("starts_at", instants);
  const already = new Set(
    ((existing ?? []) as Record<string, unknown>[]).map((r) =>
      new Date(String(r.starts_at)).toISOString()
    )
  );
  const fresh = instants.filter((i) => !already.has(i));
  if (fresh.length === 0)
    return { ok: false, message: "هذه المواعيد مفتوحةٌ عندك أصلاً." };

  const { error } = await supabase.from("availability_slots").insert(
    fresh.map((starts_at) => ({
      teacher_id: teacher.id,
      starts_at,
      minutes,
      price,
      currency,
      note,
    }))
  );
  if (error) {
    console.error("[booking] saveSlots failed:", error.message);
    return { ok: false, message: "تعذّر فتح المواعيد." };
  }

  revalidatePath("/teacher/me/booking");
  revalidatePath(`/teacher/${teacher.slug}`);
  const skipped = instants.length - fresh.length;
  return {
    ok: true,
    message:
      `فُتح ${fresh.length} موعداً.` +
      (skipped > 0 ? ` (${skipped} كان مفتوحاً من قبل)` : ""),
  };
}

/** إغلاق موعدٍ أو إعادة فتحه دون حذفه */
export async function setSlotOpen(id: string, open: boolean): Promise<BookingState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const { data } = await supabase
    .from("availability_slots")
    .update({ is_open: open })
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");
  if (!data || data.length === 0) return { ok: false, message: "تعذّر التغيير." };

  revalidatePath("/teacher/me/booking");
  revalidatePath(`/teacher/${teacher.slug}`);
  return { ok: true, message: open ? "أُعيد فتح الموعد." : "أُغلق الموعد." };
}

/**
 * حذف موعد.
 *
 * **يُرفض إن كان عليه طلب.** الحذف يجرف الحجز معه (`on delete cascade`)،
 * فيختفي موعد الطالب من لوحته بلا كلمة ولا سبب. على المعلّم أن يعتذر
 * صراحةً — يرفض الطلب بملاحظة — ثم يحذف.
 */
export async function deleteSlot(id: string): Promise<BookingState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const { data: booked } = await supabase
    .from("session_bookings")
    .select("id")
    .eq("slot_id", id)
    .in("status", ["pending", "approved"])
    .limit(1);
  if (booked && booked.length > 0)
    return {
      ok: false,
      message: "على هذا الموعد طلبٌ قائم. اردده أوّلاً ليعلم الطالب، ثم احذفه.",
    };

  const { data } = await supabase
    .from("availability_slots")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");
  if (!data || data.length === 0) return { ok: false, message: "تعذّر الحذف." };

  revalidatePath("/teacher/me/booking");
  revalidatePath(`/teacher/${teacher.slug}`);
  return { ok: true, message: "حُذف الموعد." };
}

/** طلب الطالب حجزَ موعد — يصل المعلّم **قيد المراجعة** */
export async function requestBooking(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً لتحجز." };

  const slotId = String(formData.get("slotId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const topic = stripTags(String(formData.get("topic") ?? "")).trim().slice(0, 300);
  const participants = stripTags(String(formData.get("participants") ?? ""))
    .trim()
    .slice(0, 300);

  if (!slotId || !teacherId) return { ok: false, message: "اختر موعداً أوّلاً." };
  if (!topic) return { ok: false, message: "اكتب موضوع الحصّة." };
  if (!participants) return { ok: false, message: "اكتب اسم الطالب أو الطلاب." };

  const { error } = await supabase.from("session_bookings").insert({
    slot_id: slotId,
    teacher_id: teacherId,
    student_id: user.id,
    topic,
    participants,
  });

  if (error) {
    console.error("[booking] request failed:", error.message);
    // القيد الفريد الجزئي: سبقك غيرك إلى الموعد نفسه
    if (error.code === "23505")
      return { ok: false, message: "حُجز هذا الموعد قبل قليل. اختر موعداً آخر." };
    return {
      ok: false,
      message: "تعذّر إرسال الطلب — تأكّد أن الموعد ما زال متاحاً.",
    };
  }

  if (slug) revalidatePath(`/teacher/${slug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُرسل طلبك. ستصلك الموافقة ورابط اللقاء من المعلّم." };
}

/** إلغاء الطالب طلبَه — حذفٌ يعيد الموعد متاحاً لغيره */
export async function cancelBooking(id: string): Promise<BookingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data } = await supabase
    .from("session_bookings")
    .delete()
    .eq("id", id)
    .eq("student_id", user.id)
    .select("id");
  if (!data || data.length === 0)
    return { ok: false, message: "تعذّر الإلغاء — ربّما بتّ المعلّم في الطلب." };

  revalidatePath("/dashboard");
  return { ok: true, message: "أُلغي الطلب." };
}

/**
 * قرار المعلّم: موافقةٌ برابط لقاء، أو ردّ بملاحظة.
 *
 * **الموافقة تشترط رابطاً.** الطالب الموافَق له بلا رابط ينتظر شيئاً لا
 * يأتي، ولا يعرف أعليه أن يسأل أم ينتظر. والرابط يُشترط `https` وحدها:
 * ما عداها إمّا لا يفتح أو ليس لقاءً.
 */
export async function decideBooking(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const id = String(formData.get("bookingId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = stripTags(String(formData.get("note") ?? "")).trim().slice(0, 500);
  const meetRaw = String(formData.get("meetUrl") ?? "").trim().slice(0, 500);

  if (decision !== "approved" && decision !== "rejected")
    return { ok: false, message: "قرارٌ غير معروف." };

  let meetUrl: string | null = null;
  if (decision === "approved") {
    if (!meetRaw)
      return { ok: false, message: "ضَع رابط اللقاء (Google Meet) قبل الموافقة." };
    let u: URL;
    try {
      u = new URL(meetRaw);
    } catch {
      return { ok: false, message: "رابط اللقاء غير صالح." };
    }
    if (u.protocol !== "https:")
      return { ok: false, message: "رابط اللقاء يجب أن يبدأ بـ https." };
    meetUrl = u.toString();
  }

  const { data, error } = await supabase
    .from("session_bookings")
    .update({
      status: decision,
      meet_url: meetUrl,
      teacher_note: note,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: "تعذّر حفظ القرار." };

  revalidatePath("/teacher/me/booking");
  revalidatePath(`/teacher/${teacher.slug}`);
  return {
    ok: true,
    message: decision === "approved" ? "وافقتَ وأُرسل الرابط للطالب." : "رُدّ الطلب.",
  };
}
