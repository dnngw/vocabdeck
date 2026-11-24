import Link from "next/link";
import { Layers3 } from "lucide-react";
export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight"
      aria-label="Vocabdeck beranda"
    >
      <span className="rounded-xl bg-primary p-2 text-white">
        <Layers3 size={22} />
      </span>
      vocabdeck<span className="text-primary">.</span>
    </Link>
  );
}
