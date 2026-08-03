import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COST, OUT_OF_CREDITS, type AiTool } from "@/lib/ai/credits";

/**
 * خصم ثمن أداة من رصيد المعلّم — **قبل استدعاء النموذج لا بعده**.
 *
 * الترتيب مقصود: الخصم بعد النجاح يعني أن من يقطع الطلب قبل أن يعود
 * يستدعي النموذج بلا حساب، مرّةً بعد مرّة. فنخصم أولاً، ثم نردّ إن فشل
 * النداء (`refund`) — فيبقى العدل قائماً والباب مغلقاً معاً.
 *
 * والتحقّق كلّه في القاعدة (`spend_credits`, 0026): عمود الرصيد محجوبٌ
 * عن المعلّم بمنحة أعمدة، والشرط `credits >= n` داخل جملة UPDATE نفسها
 * فلا يمرّ طلبان متزامنان برصيدٍ واحد.
 */
export async function spend(
  supabase: SupabaseClient,
  tool: AiTool
): Promise<{ ok: boolean; message?: string; remaining?: number }> {
  const { data, error } = await supabase.rpc("spend_credits", {
    n: CREDIT_COST[tool],
    k: tool,
  });

  if (error) {
    console.error("[credits] spend failed:", error.message);
    return { ok: false, message: "تعذّر التحقّق من رصيدك — حاول مجدداً." };
  }
  const left = Number(data);
  if (!Number.isFinite(left) || left < 0) return { ok: false, message: OUT_OF_CREDITS };
  return { ok: true, remaining: left };
}

/**
 * ردّ ما خُصم حين يفشل النداء — مفتاحٌ منتهٍ، أو خدمةٌ مزدحمة، أو ردٌّ لا
 * يُقرأ. المعلّم لا يدفع ثمن عطلٍ ليس منه.
 *
 * ويُسجَّل الردّ سطراً سالباً في `ai_usage`، فيبقى السجلّ قصّةً كاملة
 * تُقرأ — خُصم ثم رُدّ — بدل أن يختفي الخصم كأنه لم يقع.
 */
export async function refund(
  supabase: SupabaseClient,
  tool: AiTool
): Promise<void> {
  const { error } = await supabase.rpc("refund_credits", {
    n: CREDIT_COST[tool],
    k: tool,
  });
  if (error) console.error("[credits] refund failed:", error.message);
}
