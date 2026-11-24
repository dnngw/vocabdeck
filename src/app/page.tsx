import Link from "next/link";
import { BookOpen, CalendarCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Brand />
        <Button asChild variant="outline">
          <Link href="/login">Masuk</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid items-center gap-14 py-16 lg:grid-cols-1 lg:py-24">
          
          <section
            aria-label="Contoh kartu kontekstual"
            className="relative mx-auto w-full max-w-md"
          >
            <div className="absolute inset-0 rotate-3 rounded-3xl bg-[#dcebe5]" />
            <div className="relative rounded-3xl border border-border bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Everyday English</span>
                <BookOpen size={18} />
              </div>
              <h2 className="mt-12 text-5xl font-bold tracking-tight">
                take
                <span className="ml-3 text-base font-normal text-muted-foreground">
                  verb
                </span>
              </h2>
              <p className="mt-6 text-xl leading-relaxed">
                “It{" "}
                <mark className="rounded bg-emerald-100 px-1 text-primary">
                  takes
                </mark>{" "}
                two hours to get there.”
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Apa arti “take” dalam kalimat ini?
              </p>
              <div className="mt-8 border-t border-border pt-6">
                <p className="font-semibold text-primary">membutuhkan waktu</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Perlu dua jam untuk sampai di sana.
                </p>
              </div>
            </div>
          </section>
        </div>
      
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
       <p>&copy; {new Date().getFullYear()} vocabdeck</p>
      </footer>
    </div>
  );
}
