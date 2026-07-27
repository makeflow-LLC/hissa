"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface StudentProfileState {
  ok: boolean;
  message?: string;
}

/** أرقام الهواتف اختيارية — نقبل الأرقام و + و مسافات فقط */
function cleanPhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const cleaned = v.replace(/[^0-9+\s-]/g, "").trim();
  return cleaned.length >= 6 ? cleaned.slice(0, 24) : null;
}

/**
 * حفظ بيانات الطالب في profiles.
 * الاسم والصف مطلوبان؛ الباقي اختياري — لا نغلق المنصة على من لا يريد
 * إعطاء بياناته، والهواتف تحديداً اختيارية بنصّ طلب المنصة.
 */
export async function saveStudentProfile(
  _prev: StudentProfileState,
  formData: FormData
): Promise<StudentProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  // حساب المعلّم لا يملك ملف طالب — الدوران منفصلان
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (teacher) {
    return { ok: false, message: "هذا حساب معلّم، وليس له ملف طالب." };
  }

  const fullName = stripTags(String(formData.get("full_name") ?? "")).slice(0, 80);
  const grade = stripTags(String(formData.get("grade") ?? "")).slice(0, 60);
  const school = stripTags(String(formData.get("school") ?? "")).slice(0, 100);
  const city = stripTags(String(formData.get("city") ?? "")).slice(0, 60);
  const avatar = String(formData.get("avatar") ?? "").trim() || null;

  const ageRaw = parseInt(String(formData.get("age") ?? ""), 10);
  const age = Number.isFinite(ageRaw) && ageRaw >= 4 && ageRaw <= 100 ? ageRaw : null;

  if (!fullName) return { ok: false, message: "الاسم مطلوب." };
  if (!grade) return { ok: false, message: "الصف الدراسي مطلوب." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      grade,
      school,
      city,
      age,
      avatar_url: avatar,
      phone: cleanPhone(String(formData.get("phone") ?? "")),
      whatsapp: cleanPhone(String(formData.get("whatsapp") ?? "")),
      guardian_phone: cleanPhone(String(formData.get("guardian_phone") ?? "")),
      profile_done: true,
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: "تعذّر حفظ بياناتك — حاول مجدداً." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "حُفظت بياناتك." };
}
