"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AdminState {
  ok: boolean;
  message?: string;
}

/**
 * ضبط رصيد معلّم — **والتحقّق من الصلاحية في القاعدة لا هنا**.
 *
 * `admin_set_credits` (0026) ترفض من ليس في `admins`، وعمود الرصيد
 * محجوبٌ عن كل معلّم بمنحة أعمدة. فلو تسرّب هذا الإجراء لغير إداريّ —
 * أو نُودي مباشرةً — لم يفتح شيئاً. والصفحة تتحقّق أيضاً، لكن ذلك
 * لإخفاء الواجهة لا لحمايتها.
 */
export async function setTeacherCredits(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const raw = Number(formData.get("credits"));
  if (!teacherId) return { ok: false, message: "معلّم غير محدَّد." };
  if (!Number.isFinite(raw) || raw < 0 || raw > 100000)
    return { ok: false, message: "الرصيد رقمٌ بين ٠ و١٠٠٠٠٠." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_credits", {
    t_id: teacherId,
    n: Math.round(raw),
  });

  if (error) {
    console.error("[admin] set credits failed:", error.message);
    return { ok: false, message: "تعذّر التعديل — تأكّد أنك من الإدارة." };
  }
  if (Number(data) < 0) return { ok: false, message: "لم يُعثر على المعلّم." };

  revalidatePath("/admin");
  return { ok: true, message: `صار رصيده ${data}.` };
}
