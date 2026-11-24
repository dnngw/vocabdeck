# Arsitektur Vocabdeck

## Batas tanggung jawab

Next.js App Router menyajikan halaman Indonesia dan Route Handlers pada Node.js. Browser berbicara ke API aplikasi. Supabase menangani autentikasi; Prisma dan PostgreSQL menangani konten serta progres. Tidak ada mode demo yang melewati pemeriksaan akun.

```text
UI → Route Handler → verified user context → service → Prisma → PostgreSQL
                                          → AI adapter → DeepSeek
                                          → StudyScheduler → ts-fsrs
```

- `src/lib/validation.ts`: kontrak Zod dan normalisasi NFKC.
- `src/server/auth.ts`: identitas dari `auth.getUser()`, kemudian status/role dari database.
- `src/server/content.ts`: kepemilikan deck, vocabulary, sense, example, dan deduplikasi.
- `src/server/study.ts`: queue, kuota kartu baru, transaksi rating, dan idempotensi.
- `src/lib/scheduler.ts`: satu batas integrasi untuk ts-fsrs 6 / model FSRS-7.
- `src/server/ai.ts`: reservasi kuota global/per-user sebelum memanggil adapter.
- `src/lib/ai`: kontrak provider dan adapter DeepSeek. Fitur Explain P1 belum diekspos.
- `src/server/admin.ts`: otorisasi admin, suspend, quota settings, dan audit perubahan.

## Pilihan keamanan database

Menggunakan jalur A: Prisma backend-only dengan otorisasi eksplisit, role runtime minimum, dan schema `vocabdeck` yang tidak diekspos melalui Data API. Semua service menerima `UserContext` yang hanya dibentuk setelah identitas diverifikasi dan profil berstatus active. User ID tidak diambil dari request body.

RLS diaktifkan dengan policy `runtime_access` untuk role `vocabdeck_app`. Policy ini mengizinkan role server melakukan query; **policy ini bukan pembatas tenant**. Relasi `deck.ownerId` dan `progress.userId` adalah filter wajib di service. Query statistik menggunakan parameter binding. Endpoint API memverifikasi sesi untuk setiap request, tanpa bergantung hanya pada layout/proxy.

Role runtime tidak dapat membuat profil, mengubah role, atau mengubah riwayat review/audit. Update status profil hanya tersedia melalui service admin, dengan batas 20 mutasi/admin/menit yang diperiksa di bawah lock profil. `anon` dan `authenticated` tidak memiliki akses schema. Migrations berjalan dengan credential terpisah.

Trigger Auth hanya mempercayai kolom server `invited_at` dan `email_confirmed_at`. Metadata publik hanya dapat memberi display name yang dipotong hingga 100 karakter. Konfirmasi email tidak dapat mengaktifkan ulang akun suspended. Public signup juga harus dinonaktifkan di Supabase, karena konfigurasi itu berada di luar repository.

## Model konten

Deck → VocabularyEntry → WordSense → Example. Satu kartu context-to-meaning per sense, dengan referensi example default yang stabil dan satu CardProgress per user/card. Word-to-meaning P1 belum dibuat.

Lemma dideduplikasi per deck + kata ternormalisasi + jenis kata. Makna dideduplikasi per vocabulary + makna ternormalisasi. Impor menggabungkan kata yang sama dan melewati sense yang sudah ada, tanpa menimpa contoh/progres yang telah disimpan. Batas 5 sense/kata dan 3 contoh/sense berlaku pada konten manual, CSV, dan AI.

Edit menggunakan ID sense/example yang sudah ada. Menambah/mengubah contoh tidak mengganti kartu atau progresnya. Menghapus sense/vocabulary/deck menghapus kartu, progres, dan log terkait melalui cascade; UI mengonfirmasi penghapusan. Reset progres tanpa penghapusan konten belum tersedia.

## Review dan waktu

State FSRS disimpan lengkap, termasuk `stabilityFast`, `stability`, `difficulty`, `reps`, `lapses`, `learningStep`, `scheduledDays`, timestamps, `cardId`, dan `scheduleStatus`. Envelope menyimpan model `FSRS-7`. Snapshot before/after dan revlog library tersimpan bersama jawaban. Versi scheduler dikunci; perubahan versi memerlukan validasi/migrasi format tersendiri.

Rating memakai satu transaksi:

1. Lock baris profil dan cek active untuk menyerialkan batas kartu baru lintas kartu.
2. Periksa request UUID yang pernah dipakai. Retry payload yang sama mengembalikan hasil lama; penggunaan ID untuk jawaban berbeda ditolak.
3. Periksa user, owner deck, due time, versi kartu, dan daily new limit.
4. Hitung FSRS dari state terkini di server.
5. Update versi/progres bersyarat dan insert review log dalam transaksi yang sama.

Queue mempertimbangkan due time yang tepat dan batas kartu baru seluruh deck. UI menampilkan interval hasil preview scheduler. Semua waktu database adalah `timestamptz`; daily new limit memakai timezone pengguna, default Asia/Jakarta. Statistik berasal dari log yang committed. Penghapusan konten menghapus statistik terkait sesuai keputusan cascade MVP.

## AI dan biaya

Reservasi memakai PostgreSQL advisory transaction lock global serta lock profil. Batas harian, rate per menit, dan concurrency diperiksa sebelum request provider. Lease pending lebih dari 90 detik ditandai timed_out, tetapi tetap menghabiskan kuota hari itu. Ini mencegah kegagalan/timeout menjadi cara melakukan request tanpa batas.

Timeout adapter 25 detik, output maksimal 8.000 token dan body respons 512 KB. Tidak ada retry otomatis ke provider, agar kesalahan jaringan tidak diam-diam menggandakan biaya. Setiap adapter harus memenuhi kontrak Zod. Pengguna bisa mencoba kembali secara eksplisit dan percobaan itu menggunakan kuota baru.

Kuota global berbentuk jumlah request, bukan anggaran rupiah/dolar. Token usage, durasi, provider/model, status, dan error code disimpan; prompt dan hasil mentah tidak dicatat. Pengaturan admin tidak pernah mengekspos API key. AI tidak dibutuhkan saat review.

## Batas MVP

- UI menampilkan maksimal 200 vocabulary per pencarian deck dan 200 akun terbaru; gunakan pencarian untuk deck besar.
- Undangan dikirim melalui Supabase Dashboard. Role admin pertama diatur lewat SQL terbatas pada UID yang sudah menerima undangan.
- Belum ada export, public decks, notifikasi, akun berbayar, atau fitur P1.
- Test lokal memakai PostgreSQL nyata dan fixture protokol Auth untuk browser. Validasi email Supabase, pooler cloud, RLS deployment, serta request DeepSeek nyata tetap membutuhkan staging.
