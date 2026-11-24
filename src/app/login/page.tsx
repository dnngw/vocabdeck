import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { authConfigured } from "@/lib/supabase/server";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams; const configured = authConfigured();
  return <main className="mx-auto max-w-md px-6 py-16"><Brand /><div className="panel mt-10"><p className="eyebrow">Selamat datang kembali</p><h1 className="page-title mt-3 mb-3">Lanjutkan belajarmu.</h1><p className="mb-8 text-sm leading-relaxed text-muted-foreground">Masuk dengan akun yang sudah diundang oleh admin.</p>
    {!configured && <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Vocabdeck sedang disiapkan. Login tersedia setelah pengelola menghubungkan layanan akun.</p>}
    {params.error && <p role="alert" className="mb-6 text-sm text-red-700">{params.error === "invalid_link" ? "Tautan tidak valid atau kedaluwarsa. Minta undangan baru atau reset password." : "Akses akun belum aktif atau ditangguhkan. Hubungi admin."}</p>}
    <AuthForm configured={configured} /></div><p className="mt-6 text-center text-sm text-muted-foreground">Belum mendapat undangan? Hubungi pengelola.</p></main>;
}
