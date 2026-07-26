import TeacherDirectory from "@/components/TeacherDirectory";

export default function Home() {
  return (
    <main className="container">
      <section className="hero-header">
        <h1 className="site-title">منصة حصة</h1>
        <p className="site-subtitle">
          اكتشف أفضل المعلّمين واحجز حصصك بسهولة في كل المواد والمراحل
        </p>
      </section>
      <TeacherDirectory />
    </main>
  );
}
