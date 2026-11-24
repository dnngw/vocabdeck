import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { pageUser } from "@/server/page-auth";
import { AdminService } from "@/server/admin";
import { AccountStatusButton } from "@/components/admin-controls";
export default async function Users() {
  const user = await pageUser();
  if (user.role !== "admin") notFound();
  const users = await new AdminService(getDb()).users(user);
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Administrator</p>
        <h1 className="page-title">Kelola pengguna</h1>
        <p className="mt-2 text-muted-foreground">
          Undangan dikirim melalui Supabase Dashboard. Cocokkan UID akun saat
          mengelola akses.
        </p>
      </header>
      <div className="space-y-3">
        {users.map((profile) => (
          <article
            key={profile.id}
            className="panel flex flex-wrap items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <h2 className="font-semibold">
                {profile.displayName || "Pengguna Vocabdeck"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.role} · {profile.status}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {profile.id}
              </p>
            </div>
            {profile.role !== "admin" && profile.status !== "pending" && (
              <AccountStatusButton id={profile.id} status={profile.status} />
            )}
            {profile.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Menunggu penerimaan undangan
              </p>
            )}
          </article>
        ))}
      </div>
      {users.length === 200 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Menampilkan 200 akun terbaru. Gunakan Dashboard Supabase untuk daftar
          lengkap.
        </p>
      )}
    </>
  );
}
