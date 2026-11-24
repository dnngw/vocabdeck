import { pageUser } from "@/server/page-auth";
import { getDb } from "@/lib/db";
import { StatisticsService } from "@/server/statistics";
export default async function Statistics() {
  const stats = await new StatisticsService(getDb()).summary(await pageUser());
  const max = Math.max(...stats.activity.map((d) => d.count), 1);
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Setiap review berarti</p>
        <h1 className="page-title">Statistik belajar</h1>
        <p className="mt-2 text-muted-foreground">
          Jejak kebiasaanmu, berdasarkan jawaban yang tersimpan.
        </p>
      </header>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Review hari ini", stats.today],
          ["Total review", stats.all],
          ["Kata", stats.vocabulary],
          ["Makna", stats.senses],
        ].map(([title, value]) => (
          <div key={title} className="panel">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-4 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2 className="text-lg font-semibold">Aktivitas 30 hari terakhir</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jumlah jawaban per hari · {stats.timezone}
        </p>
        <div className="mt-8 flex h-40 items-end gap-1" aria-hidden="true">
          {stats.activity.map((day) => (
            <div
              key={day.day}
              className="flex h-full min-w-0 flex-1 items-end"
              title={`${day.day}: ${day.count} review`}
            >
              <div
                className={`w-full rounded-t ${day.count ? "bg-primary" : "bg-muted"}`}
                style={{ height: `${Math.max(3, (day.count / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{stats.activity[0].day}</span>
          <span>{stats.activity[29].day}</span>
        </div>
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-primary">
            Lihat data harian
          </summary>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Aktivitas review 30 hari</caption>
            <thead>
              <tr className="text-left">
                <th className="py-2">Tanggal</th>
                <th>Jumlah review</th>
              </tr>
            </thead>
            <tbody>
              {stats.activity.map((day) => (
                <tr key={day.day} className="border-t border-border">
                  <td className="py-2">{day.day}</td>
                  <td>{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        {!stats.all && (
          <p className="mt-5 text-sm text-muted-foreground">
            Mulai sesi belajar untuk melihat aktivitas pertamamu di sini.
          </p>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="text-lg font-semibold">Distribusi jawaban</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Menggambarkan rating review, bukan nilai kemampuan bahasa Inggris.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.ratings.map((r, i) => (
            <div key={r.rating} className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                {["Again", "Hard", "Good", "Easy"][i]}
              </p>
              <p className="mt-2 text-2xl font-semibold">{r.count}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
