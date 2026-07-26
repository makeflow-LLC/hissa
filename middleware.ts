import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // كل المسارات ما عدا الملفات الثابتة والصور
    "/((?!_next/static|_next/image|favicon.ico|files/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|mp4)$).*)",
  ],
};
