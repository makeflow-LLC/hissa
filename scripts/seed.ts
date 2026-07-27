/**
 * نقل البيانات التجريبية من lib/teachers.ts إلى قاعدة Supabase.
 *
 * التشغيل:   npm run seed
 * يتطلب في ‎.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (المفتاح السري — يتجاوز RLS للإدخال)
 *
 * السكربت آمن التكرار (idempotent): إعادة تشغيله تحدّث بيانات المعلم
 * وتعيد بناء منهجه من الصفر بدل تكرار الصفوف.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { teachers } from "../lib/teachers";

// تحميل ‎.env.local يدوياً (بلا اعتماد على Next)
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mexpmtuqhvnphgeqqjuf.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("❌ ينقص SUPABASE_SERVICE_ROLE_KEY في ملف .env.local");
  console.error(
    "   تجده في: Supabase Dashboard → Project Settings → API → service_role"
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`🌱 نقل ${teachers.length} معلمين إلى ${url} ...`);

  for (const t of teachers) {
    // ١) المعلم (upsert بالـ slug حتى يكون التكرار آمناً)
    const { data: teacherRow, error: tErr } = await db
      .from("teachers")
      .upsert(
        {
          slug: t.slug,
          name: t.name,
          subject: t.subject,
          stages: [t.stage],
          bio: t.bio,
          initials: t.initials,
          gradient: t.gradient,
          rating: t.rating,
          rating_count: t.ratingCount,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (tErr) throw new Error(`teacher ${t.slug}: ${tErr.message}`);
    const teacherId = teacherRow.id as string;

    // ٢) تنظيف منهجه القديم ثم إعادة البناء (حذف الوحدات يسحب الدروس
    //    ومرفقاتها وأسئلتها عبر on delete cascade)
    for (const table of ["units", "live_sessions"] as const) {
      const { error } = await db.from(table).delete().eq("teacher_id", teacherId);
      if (error) throw new Error(`clean ${table} for ${t.slug}: ${error.message}`);
    }
    // دروس بلا وحدة (unit_id صار null بعد حذف الوحدات)
    {
      const { error } = await db.from("lessons").delete().eq("teacher_id", teacherId);
      if (error) throw new Error(`clean lessons for ${t.slug}: ${error.message}`);
    }

    // ٣) الوحدات والدروس
    for (const [ui, unit] of t.units.entries()) {
      const { data: unitRow, error: uErr } = await db
        .from("units")
        .insert({
          teacher_id: teacherId,
          title: unit.title,
          description: unit.description,
          position: ui,
        })
        .select("id")
        .single();
      if (uErr) throw new Error(`unit ${unit.id}: ${uErr.message}`);

      for (const [li, lesson] of unit.lessons.entries()) {
        const { data: lessonRow, error: lErr } = await db
          .from("lessons")
          .insert({
            teacher_id: teacherId,
            unit_id: unitRow.id,
            status: "published",
            title: lesson.title,
            description: lesson.description,
            duration: lesson.duration,
            emoji: lesson.emoji,
            gradient: lesson.gradient,
            video_url: lesson.videoUrl,
            sections: lesson.sections,
            gallery: lesson.gallery,
            position: li,
          })
          .select("id")
          .single();
        if (lErr) throw new Error(`lesson ${lesson.id}: ${lErr.message}`);

        if (lesson.attachments.length > 0) {
          const { error } = await db.from("lesson_attachments").insert(
            lesson.attachments.map((a, ai) => ({
              lesson_id: lessonRow.id,
              name: a.name,
              kind: a.kind,
              size: a.size,
              file_path: a.file,
              position: ai,
            }))
          );
          if (error) throw new Error(`attachments ${lesson.id}: ${error.message}`);
        }
      }
    }

    // ٤) الحصص المباشرة
    if (t.liveSessions.length > 0) {
      const { error } = await db.from("live_sessions").insert(
        t.liveSessions.map((s) => ({
          teacher_id: teacherId,
          status: "published",
          title: s.title,
          description: s.description,
          schedule: s.schedule,
          duration: s.duration,
          seats_left: s.seatsLeft,
          emoji: s.emoji,
          gradient: s.gradient,
        }))
      );
      if (error) throw new Error(`live_sessions ${t.slug}: ${error.message}`);
    }

    console.log(`  ✅ ${t.name} (${t.units.length} وحدات، ${t.liveSessions.length} حصص مباشرة)`);
  }

  console.log("🎉 اكتمل النقل بنجاح.");
}

main().catch((e) => {
  console.error("❌ فشل النقل:", e.message);
  process.exit(1);
});
