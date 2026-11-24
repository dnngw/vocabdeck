"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel"><h1 className="page-title">Belum bisa memuat data</h1><p className="my-5 text-muted-foreground">Periksa koneksi dan coba kembali. Jika berlanjut, hubungi pengelola.</p><Button onClick={reset}>Coba kembali</Button></section>;
}
