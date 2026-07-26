"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل Supabase للمتصفح — يستخدم المفتاح العام (anon) فقط.
 * سياسات RLS في قاعدة البيانات هي خط الحماية، لا هذا المفتاح.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
