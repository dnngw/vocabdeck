"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Layers3,
  BookOpen,
  Sparkles,
  ChartNoAxesColumn,
  Settings2,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/decks", label: "Deck saya", icon: Layers3 },
  { href: "/study", label: "Belajar", icon: BookOpen },
  { href: "/ai/generate", label: "Buat dengan AI", icon: Sparkles },
  { href: "/statistics", label: "Statistik", icon: ChartNoAxesColumn },
  { href: "/settings", label: "Pengaturan", icon: Settings2 },
];
export function AppShell({
  name,
  admin,
  children,
}: {
  name: string;
  admin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen lg:pl-64">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:p-4"
      >
        Lewati ke konten
      </a>
      <header className="flex items-center justify-between border-b border-border bg-white p-4 lg:hidden">
        <Brand />
        <Button
          variant="ghost"
          aria-label={open ? "Tutup navigasi" : "Buka navigasi"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      <aside
        className={cn(
          "z-40 flex flex-col border-r border-border bg-white p-6 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64",
          open ? "block" : "hidden lg:flex",
        )}
      >
        <div className="mb-12 hidden lg:block">
          <Brand />
        </div>
        <p className="eyebrow mb-4">Ruang belajarmu</p>
        <nav aria-label="Navigasi utama" className="space-y-1">
          {[
            ...links,
            ...(admin
              ? [
                  {
                    href: "/admin/users",
                    label: "Kelola pengguna",
                    icon: Users,
                  },
                  {
                    href: "/admin/usage",
                    label: "Pemakaian AI",
                    icon: Sparkles,
                  },
                ]
              : []),
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted",
                pathname.startsWith(href) && "bg-emerald-50 text-primary",
              )}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-6 lg:mt-auto">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-primary">
              {(name || "P").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {name || "Pelajar"}
              </p>
              <p className="text-xs text-muted-foreground">
                {admin ? "Administrator" : "Koleksi pribadi"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await apiFetch("/api/auth/logout", { method: "POST" });
                router.replace("/login");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
            {busy ? "Keluar…" : "Keluar"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </aside>
      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12"
      >
        {children}
      </main>
    </div>
  );
}
