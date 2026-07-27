import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * نقطة العودة من جوجل أو من الرابط السحري.
 *
 * تدعم صيغتين:
 * - `token_hash` (verifyOtp): تعمل من أي متصفح أو جهاز.
 * - `code` (PKCE): تحتاج «code_verifier» المخزَّن في كوكي المتصفح الذي
 *   طلب الرابط. إن فُتح الرابط في متصفح آخر يفشل التبديل، فنعرض رسالة
 *   عربية مفهومة بدل نص الخطأ الإنجليزي الخام.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (authError) return fail(authError);

  // الصيغة المفضّلة: تعمل عبر الأجهزة والمتصفحات
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return fail("انتهت صلاحية رابط الدخول أو استُخدم من قبل. اطلب رابطاً جديداً.");
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);

    // فشل PKCE يعني غالباً أن الرابط فُتح في متصفح غير الذي طلبه
    const raw = `${error.message} ${error.name ?? ""}`.toLowerCase();
    const isVerifierProblem =
      raw.includes("code verifier") ||
      raw.includes("code_verifier") ||
      raw.includes("pkce");

    return fail(
      isVerifierProblem
        ? "افتح رابط الدخول من نفس المتصفح الذي طلبته منه. إن وصلك الرابط في تطبيق البريد، انسخه والصقه في متصفحك ثم افتحه — أو اطلب رابطاً جديداً من هنا."
        : "تعذّر إتمام الدخول. اطلب رابطاً جديداً وحاول مرة أخرى."
    );
  }

  return fail("رابط الدخول غير صالح أو منتهي.");
}
