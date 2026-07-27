"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

/**
 * عميل Supabase للمتصفح — يستخدم المفتاح العام (anon) فقط.
 * سياسات RLS في قاعدة البيانات هي خط الحماية، لا هذا المفتاح.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
