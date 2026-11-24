import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { requireUser } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function Password() {
  try {
    await requireUser();
  } catch {
    redirect("/login?error=invalid_link");
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Brand />
      <section className="panel mt-10">
        <h1 className="page-title mb-6">Siapkan password</h1>
        <AuthForm mode="password" />
      </section>
    </main>
  );
}
