# Operasional dan pemulihan

## Backup sebelum beta

Sediakan backup database lengkap melalui fasilitas Supabase atau alur backup resmi yang mencakup schema aplikasi dan kebutuhan pemulihan Supabase Auth. Jangan mengasumsikan paket layanan tertentu sudah menyediakan backup yang memadai. Backup konten saja tidak dapat memulihkan akun Auth.

Dump tambahan khusus konten dapat dibuat dengan PostgreSQL client dan credential migrasi melalui environment lokal:

```sh
pg_dump --dbname="$DIRECT_URL" --format=custom --schema=vocabdeck --file=vocabdeck-content.dump
```

Simpan dump terenkripsi di lokasi privat di luar repository, dengan akses terbatas. File dump berisi data pengguna. Jangan menyimpan connection string dalam command yang disalin ke tiket/log publik. Retensi awal yang disarankan: backup harian 7 hari dan mingguan 4 minggu, disesuaikan kapasitas/layanan.

## Latihan restore

1. Buat proyek staging kosong yang tidak menerima traffic production.
2. Pulihkan database/Auth melalui prosedur resmi Supabase sesuai jenis backup. UID Auth harus sama dengan `profiles.id`.
3. Jika menggunakan dump konten tambahan, inspeksi terlebih dahulu dengan `pg_restore --list vocabdeck-content.dump`. Jalankan restore hanya ke target kosong/terisolasi dengan credential yang sesuai. Jangan memakai `--clean` terhadap database production.
4. Pastikan role runtime, grants, policy, fungsi, dan trigger Auth ada. Bandingkan dengan migrations yang tercatat; jangan menerapkan ulang migration yang sudah ada tanpa rekonsiliasi riwayat.
5. Verifikasi jumlah vocabulary/sense, referensi default example, due time, log review, status akun, dan login dua pengguna yang berbeda.
6. Jalankan pemeriksaan staging di `TESTING.md`, baru putuskan pemulihan production. Catat waktu backup terakhir dan kemungkinan data yang hilang sejak snapshot tersebut.

## Pemantauan

- `/admin/usage` menunjukkan request, token, durasi, dan error code AI. Gunakan switch untuk menghentikan request baru ketika diperlukan.
- Log runtime hanya mencatat kelas error umum; tidak menulis credential atau input AI. Pantau error rate dan latency di Vercel. Hubungkan layanan monitoring bila diperlukan sebelum peluncuran publik.
- Periksa penggunaan koneksi/storage Supabase dan status proyek. Kegagalan AI tidak boleh menghentikan jalur manual/CSV/review.
- Pending AI yang macet dibersihkan menjadi timed_out pada reservasi berikutnya. Kegagalan tetap dihitung terhadap kuota harian.
- Kebijakan retensi awal: AI usage 90 hari dan audit admin 180 hari. Pembersihan dilakukan admin melalui SQL terkontrol setelah backup; jangan menghapus usage hari berjalan karena digunakan quota counter. Belum ada cron pembersihan otomatis.

## Tangguhkan akses dan hapus akun

Suspend melalui `/admin/users` berlaku pada request fitur berikutnya, termasuk sesi yang cookie-nya masih valid. Untuk insiden credential, cabut sesi di Supabase dan rotasi secret terkait di lingkungan deployment.

Menghapus pengguna melalui Supabase Dashboard menghapus profil dan konten terkait melalui foreign key cascade. Ini tindakan permanen: buat backup/export administratif terlebih dahulu sesuai kebutuhan. Audit admin menyimpan UID tanpa FK agar catatan tindakan tidak hilang ketika akun dihapus; hapus audit secara terpisah bila kebijakan retensi mengharuskannya.

## Rollback rilis

Gunakan deployment Vercel sebelumnya jika skema tetap kompatibel. Migrasi database bukan otomatis reversible. Untuk perubahan skema ke depan, gunakan pola expand/contract, backup, dan forward migration yang sudah diuji. Jangan menjalankan `prisma migrate reset` atau `db push` pada staging/production yang menyimpan data pengguna.

Referensi: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
