import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * نقطة العودة من جوجل.
 *
 * الدخول صار بحساب جوجل وحده، فلم يبقَ إلا تبديل رمز PKCE بجلسة. ولأن
 * الرحلة كلها تجري في المتصفح نفسه — لا رابط بريد يُفتح في متصفح آخر —
 * سقط سبب أعطال «code_verifier» التي كانت تلاحق الروابط السحرية.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (authError) return fail(authError);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return fail("تعذّر إتمام الدخول بحساب جوجل. حاول مرّة أخرى من صفحة الدخول.");
  }

  return fail("رابط الدخول غير صالح أو منتهي.");
}
