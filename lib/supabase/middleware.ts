import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * تحديث كوكيز جلسة Supabase على كل طلب.
 * بدونها تنتهي جلسة الطالب عند انقضاء صلاحية التوكن ولا تُجدَّد،
 * فيبدو الطالب مسجّلاً في المتصفح ومجهولاً على الخادم.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // بيئة بلا إعداد Supabase (بناء بدون مفاتيح) — نمرّر الطلب كما هو
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // مهم: getUser() هو ما يجدّد التوكن ويكتب الكوكيز المحدّثة
  await supabase.auth.getUser();

  return response;
}
