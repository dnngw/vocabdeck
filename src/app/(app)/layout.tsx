import { AppShell } from "@/components/app-shell";
import { pageUser } from "@/server/page-auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await pageUser();
  return (
    <AppShell name={user.displayName} admin={user.role === "admin"}>
      {children}
    </AppShell>
  );
}
