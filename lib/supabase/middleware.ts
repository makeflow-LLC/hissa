import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

/**
 * تحديث كوكيز جلسة Supabase على كل طلب.
 * بدونها تنتهي جلسة الطالب عند انقضاء صلاحية التوكن ولا تُجدَّد،
 * فيبدو الطالب مسجّلاً في المتصفح ومجهولاً على الخادم.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  try {
    // مهم: getUser() هو ما يجدّد التوكن ويكتب الكوكيز المحدّثة
    await supabase.auth.getUser();
  } catch {
    /* فشل الشبكة لا يمنع عرض الصفحة — الصفحات تتعامل مع غياب الجلسة */
  }

  return response;
}
