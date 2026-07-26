import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * عميل Supabase لمكونات الخادم (Server Components / Route Handlers).
 * يقرأ جلسة المستخدم من الكوكيز؛ الكتابة على الكوكيز تتم في Middleware
 * أو Route Handlers فقط — لذلك setAll هنا يتجاهل الخطأ بصمت عندما
 * يُستدعى من Server Component (سلوك موصى به من وثائق Supabase).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* استدعاء من Server Component — الكوكيز تُحدَّث في مكان آخر */
          }
        },
      },
    }
  );
}
