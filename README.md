# Vocabdeck

Aplikasi vocabulary bahasa Inggris berbasis konteks, berbahasa Indonesia, dengan akses melalui undangan. Stack: Next.js App Router, React, TypeScript, Tailwind/shadcn, Supabase Auth + PostgreSQL, Prisma, dan ts-fsrs.

## Fitur yang tersedia

- Deck pribadi, pencarian vocabulary, hingga 5 makna/kata dan 3 contoh/makna.
- Kartu context-to-meaning dengan FSRS, daily new limit, riwayat atomik, dan retry idempoten.
- Impor CSV melalui preview/seleksi, dengan validasi dan deduplikasi.
- Adapter DeepSeek: hasil bisa diedit/dipilih, kuota atomik, timeout, kill switch, dan log pemakaian.
- Statistik pribadi, timezone, pengaturan review, serta admin suspend/reactivate.
- Login, penerimaan undangan, reset password, dan isolasi data antar-pengguna.

Implementasi lokal sudah tersedia. Peluncuran masih membutuhkan proyek Supabase, konfigurasi SMTP, credential, serta validasi integrasi nyata di staging. Tidak ada deployment atau remote Git yang dibuat otomatis.

## Pengembangan lokal

```sh
nvm use
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

Buka http://localhost:3000. Halaman publik bisa dibuka tanpa kredensial. Fitur privat membutuhkan Supabase dan database; ikuti [panduan setup](docs/SETUP.md). Jangan gunakan data produksi untuk pengujian.

## Pemeriksaan

```sh
npm run check
npm run build
```

[Panduan pengujian](docs/TESTING.md) menjelaskan database integrasi dan Playwright. Tes provider dan browser menggunakan fixture, sehingga tidak memakai saldo AI atau mengirim email.

## Dokumentasi

- [Setup Supabase, akun admin, AI, dan Vercel](docs/SETUP.md)
- [Arsitektur dan batas keamanan](docs/ARCHITECTURE.md)
- [Pengujian dan verifikasi staging](docs/TESTING.md)
- [Backup, restore, dan operasional](docs/OPERATIONS.md)

PRD dan file environment aktif sengaja diabaikan oleh Git. Semua migrasi aplikasi disimpan di repository.
