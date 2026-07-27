import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * تأكيد رابط البريد بصيغة token_hash — الصيغة التي تعمل عبر الأجهزة.
 *
 * لماذا هذا المسار موجود بجانب /auth/callback؟
 * مسار callback يستخدم تدفّق PKCE: المتصفح الذي طلب الرابط يخزّن
 * «code_verifier» في كوكي، وتبديل الكود بجلسة يحتاجه. إن فُتح الرابط في
 * متصفح آخر (تطبيق البريد يفتح نافذته الخاصة، أو التطبيق المثبَّت يحيل
 * إلى المتصفح الافتراضي) فالكوكي غير موجود ويفشل الدخول.
 *
 * verifyOtp بـ token_hash لا يحتاج أي شيء مخزَّناً مسبقاً، فيعمل من أي
 * متصفح أو جهاز. يتطلّب أن يشير قالب البريد في Supabase إلى هذا المسار.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("رابط الدخول غير صالح أو منتهي.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "انتهت صلاحية رابط الدخول أو استُخدم من قبل. اطلب رابطاً جديداً."
      )}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
