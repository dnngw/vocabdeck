import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Vocabdeck — Pahami kata dalam konteks", template: "%s | Vocabdeck" }, description: "Belajar kosakata bahasa Inggris lewat konteks kalimat dan pengulangan terjadwal." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
