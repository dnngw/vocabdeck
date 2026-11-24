import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { pageUser } from "@/server/page-auth";
import { AdminService } from "@/server/admin";
import { AiSettings } from "@/components/admin-controls";
export default async function Usage() {
  const user = await pageUser();
  if (user.role !== "admin") notFound();
  const usage = await new AdminService(getDb()).usage(user);
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Administrator</p>
        <h1 className="page-title">Pemakaian AI</h1>
        <p className="mt-2 text-muted-foreground">
          {usage.todayCount} request hari ini ·{" "}
          {usage.enabled ? "Diaktifkan" : "Dinonaktifkan"}
        </p>
      </header>
      <AiSettings
        initial={{ ...usage.limits, enabled: usage.enabled }}
        environmentEnabled={usage.environmentEnabled}
      />
      <section className="panel mt-6">
        <h2 className="mb-5 text-lg font-semibold">100 request terakhir</h2>
        {!usage.recent.length ? (
          <p className="text-muted-foreground">Belum ada pemakaian AI.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-3">Waktu (UTC)</th>
                  <th>Pengguna</th>
                  <th>Status</th>
                  <th>Token in / out</th>
                  <th>Durasi</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((item) => (
                  <tr className="border-t border-border" key={item.id}>
                    <td className="py-3 pr-4">
                      {item.createdAt
                        .toISOString()
                        .slice(0, 19)
                        .replace("T", " ")}
                    </td>
                    <td className="pr-4" title={item.userId}>
                      {item.userId.slice(0, 8)}
                    </td>
                    <td className="pr-4">
                      {item.status}
                      <span className="block text-xs text-muted-foreground">
                        {item.errorCode || `${item.provider} / ${item.model}`}
                      </span>
                    </td>
                    <td>
                      {item.tokensIn ?? "—"} / {item.tokensOut ?? "—"}
                    </td>
                    <td>
                      {item.durationMs == null
                        ? "—"
                        : `${(item.durationMs / 1000).toFixed(1)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
