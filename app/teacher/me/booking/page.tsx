import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ConnectionNotice from "@/components/ConnectionNotice";
import SlotManager from "@/components/SlotManager";
import BookingRequests from "@/components/BookingRequests";
import {
  getBookingRequests,
  getCurrentUser,
  getMySlots,
  getMyTeacher,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مواعيدي | منصة حصة" };

export default async function TeacherBookingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/booking");
  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let slots, bookings;
  try {
    [slots, bookings] = await Promise.all([getMySlots(), getBookingRequests()]);
  } catch {
    return <ConnectionNotice />;
  }

  const waiting = bookings.filter((b) => b.status === "pending").length;

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="🗓"
        title="المواعيد والحجوزات"
        subtitle={
          waiting > 0
            ? `${waiting} طلباً بانتظار قرارك`
            : "افتح مواعيدك، ودع الطالب يختار منها."
        }
      />

      <SlotManager slots={slots} />
      <BookingRequests bookings={bookings} />
    </main>
  );
}
