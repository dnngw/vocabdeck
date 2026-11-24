# Vocabdeck

Aplikasi vocabulary bahasa Inggris berbasis konteks, berbahasa Indonesia, dengan akses melalui undangan. Stack: Next.js App Router, React, TypeScript, Tailwind/shadcn, Supabase Auth + PostgreSQL, Prisma, dan ts-fsrs.

## Pengembangan lokal

```sh
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

Buka http://localhost:3000. Halaman publik bisa dibuka tanpa kredensial. Fitur privat membutuhkan Supabase dan database; konfigurasi akan dijelaskan di `docs/SETUP.md`. Jangan gunakan data produksi untuk pengujian.

PRD dan file environment aktif sengaja diabaikan oleh Git. Semua migrasi aplikasi disimpan di repository.
