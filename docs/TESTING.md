# Pengujian Vocabdeck

## Pemeriksaan lokal

```sh
npm ci
npm run db:generate
npm run check
npm run build
npm run format:check
```

`check` menjalankan ESLint, TypeScript, dan Vitest unit. Build produksi menggunakan Webpack Next.js. File `next-env.d.ts` dan Prisma Client dihasilkan ulang oleh tool masing-masing dan tidak disimpan dalam Git.

## PostgreSQL integrasi

Gunakan database PostgreSQL **khusus pengujian** dengan nama berakhiran `_test`. Suite membuat/menghapus fixture akun serta menguji perubahan transaksi. Credential migrasi/test harus dapat membuat role, tabel sementara, dan constraint. Jangan menunjuk Supabase yang menyimpan data pengguna.

Contoh dengan PostgreSQL lokal yang sudah tersedia:

```sh
createdb vocabdeck_test
export TEST_DATABASE_URL='postgresql://LOCAL_USER@127.0.0.1:5432/vocabdeck_test'
DIRECT_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run test:integration
```

Ganti `LOCAL_USER` dan port sesuai PostgreSQL lokal. Pada autentikasi lokal trust, test membuat role `vocabdeck_app` menjadi LOGIN lalu menggunakannya tanpa password. Jika database test memakai password, siapkan password role tersebut dan isi `TEST_RUNTIME_DATABASE_URL` dengan koneksi runtime yang sesuai. URL database admin tetap di `TEST_DATABASE_URL`.

Pengujian meliputi:

- Penolakan akses deck, vocabulary, nested example, serta review milik pengguna lain.
- Penolakan akun suspended dan pengguna biasa di service admin.
- Izin terbatas role runtime, termasuk larangan membuat profil/admin.
- Fungsi trigger undangan yang benar-benar dipasang oleh migrasi, diuji lewat tabel sementara. Metadata publik tidak dapat memberi role/status; signup non-undangan tetap pending; konfirmasi ulang tidak membuka suspend.
- Satu rating untuk satu versi, retry idempoten, dan rollback progress jika insert log gagal.
- Daily new limit atomik lintas kartu, progres independen per sense, dan preservasi progress saat edit.
- CSV preview tanpa write, invalid rows, dan duplikat pada impor berulang.
- Kuota AI atomik antar-user, concurrency, pergantian hari UTC, stale lease, request gagal, serta kill switch.

## Browser desktop dan mobile

```sh
npx playwright install chromium --only-shell
export TEST_DATABASE_URL='postgresql://LOCAL_USER@127.0.0.1:5432/vocabdeck_test'
npm run test:e2e
```

Playwright menjalankan aplikasi development pada port 3100 dan fixture protokol Supabase Auth pada port 55434. Kedua port harus bebas. Fixture hanya berada di `tests/e2e`, tidak diimpor oleh aplikasi, dan tidak memberikan endpoint bypass di build production. Semua operasi konten/review menggunakan API serta PostgreSQL nyata.

Resolusi: 1440×1000 dan 360×800. Alur yang diuji: preview AI → edit/pilih → validasi → save, public/private routes, create deck → multi-sense → review → reload, CSV preview/import ketika AI mati, tenant isolation, CSRF origin, dan suspend dengan sesi yang masih ada. Pada tes AI, respons generation diganti fixture browser; validasi duplikat dan save tetap melalui backend nyata.

Screenshot/trace kegagalan ada di `test-results/`; laporan HTML di `playwright-report/`. Keduanya diabaikan Git. Untuk memasang browser di lokasi lain, gunakan `PLAYWRIGHT_BROWSERS_PATH` yang sama saat install dan saat menjalankan test.

## Hasil verifikasi implementasi awal

Pada 24 November 2026: 15 unit test, 19 integration test PostgreSQL, dan 10 skenario browser desktop/mobile tersedia. Lihat hasil command masing-masing untuk status terbaru. Pemeriksaan ini tidak mengklaim pengiriman email Supabase atau request DeepSeek nyata sudah diuji.

## Gerbang staging sebelum beta

- Terapkan migrasi ke proyek Supabase staging baru; pastikan trigger terpasang pada `auth.users` dan koneksi runtime menggunakan `vocabdeck_app`, bukan `postgres`.
- Public signup melalui Auth API harus gagal. Tidak cukup hanya memeriksa ketiadaan tombol daftar.
- Undang dua email nyata, terima undangan di perangkat/browser berbeda, tetapkan password, login/logout, dan lakukan reset password. Tautan kedaluwarsa harus ditolak.
- Buat data di dua akun. Tebakan ID resource akun lain harus menghasilkan 404 dan tidak mengubah data.
- Suspend akun saat sesi masih aktif; dashboard/API harus langsung menolak request selanjutnya.
- Pastikan `anon`/`authenticated` tidak dapat membaca schema aplikasi melalui Data API, dan schema `vocabdeck` tidak termasuk exposed schemas.
- Uji kartu dengan semua rating, reload, konflik dua tab, daily new limit, dan Learning/Relearning yang due dalam menit.
- Aktifkan DeepSeek dengan saldo/batas yang disetujui. Uji generation nyata, preview edit/save, output invalid/timeout, limit global/per-user, dan kill switch.
- Verifikasi penggunaan transaction pooler di Vercel dan direct/session pooler untuk migrasi. Pantau koneksi dan timeout.
- Latih backup/restore ke lingkungan terpisah sesuai `OPERATIONS.md`.

Setelah langkah tersebut lulus, barulah acceptance criteria PRD yang bergantung pada layanan eksternal dapat dinyatakan selesai.
