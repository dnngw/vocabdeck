# Menyiapkan Vocabdeck

## 1. Jalankan proyek lokal

Gunakan Node.js 24 LTS dan npm. Versi dependency dikunci dalam `package-lock.json`.

```sh
nvm use
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

Buka http://localhost:3000. Halaman publik dapat dibuka tanpa Supabase. Login dan fitur privat sengaja tidak menggunakan akun demo atau bypass autentikasi.

## 2. Buat proyek Supabase

1. Buat proyek development di Supabase. Simpan password database di password manager.
2. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari pengaturan API proyek ke `.env.local`.
3. Isi `DIRECT_URL` dengan koneksi direct atau **session pooler port 5432** menggunakan role migrasi yang memiliki hak membuat schema, role, fungsi, dan trigger. Salin hostname persis dari dialog Connect, jangan menebaknya. Password yang mengandung karakter khusus harus di-URL-encode.
4. Jalankan migrasi sebelum mengundang pengguna:

```sh
npm run db:migrate
```

Migrasi membuat schema privat `vocabdeck`, role `vocabdeck_app`, serta trigger profil pada `auth.users`. Tabel `auth.users` tetap dimiliki dan dikelola oleh Supabase. Jika memakai PostgreSQL biasa untuk unit integrasi, trigger Auth tidak dipasang; ini bukan pengganti Supabase Auth untuk aplikasi nyata.

## 3. Pisahkan koneksi aplikasi dan migrasi

Role `vocabdeck_app` dibuat sebagai `NOLOGIN`. Aktifkan melalui SQL Editor Supabase dengan password baru yang kuat:

```sql
ALTER ROLE vocabdeck_app WITH LOGIN PASSWORD '<password-runtime-dari-password-manager>';
```

Isi `DATABASE_URL` dengan koneksi **transaction pooler port 6543**, menggunakan role tersebut. Bentuk umumnya:

```text
postgresql://vocabdeck_app.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres
```

Gunakan detail connection string proyek Anda. Prisma 7 menggunakan `@prisma/adapter-pg`; adapter menjalankan query tanpa nama prepared statement. Jangan menyalin opsi engine Prisma versi lama tanpa memeriksa kompatibilitas. Maksimal koneksi per proses aplikasi saat ini 3.

`DATABASE_URL` bukan koneksi `postgres` pemilik database. `DIRECT_URL` hanya dibutuhkan untuk migrasi, tidak untuk request aplikasi. Pada Vercel, lebih baik simpan credential migrasi di pipeline migrasi terpisah. Jangan berikan credential privileged kepada browser.

Jangan menambahkan `vocabdeck` ke daftar exposed schemas Supabase Data API. `anon` dan `authenticated` tidak diberi izin schema tersebut. RLS mengizinkan role server khusus; **isolasi antar-pengguna pada koneksi Prisma ditegakkan service aplikasi**, bukan policy JWT otomatis. Lihat [ARCHITECTURE.md](ARCHITECTURE.md).

## 4. Konfigurasi akses khusus undangan

Di pengaturan Supabase Auth:

1. Nonaktifkan **Allow new users to sign up** / public signup.
2. Pertahankan provider email/password dan konfirmasi email.
3. Atur Site URL menjadi `http://localhost:3000` untuk development.
4. Tambahkan redirect URL `http://localhost:3000/auth/callback` dan `http://localhost:3000/auth/password`.
5. Pasang SMTP untuk pengiriman email nyata. Jangan bergantung pada email development untuk beta pengguna.

Gunakan template tautan berbasis token hash agar undangan dapat dibuka di perangkat lain. Pada template **Invite user**:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite">
  Terima undangan Vocabdeck
</a>
```

Pada template **Reset password**:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">
  Atur ulang password Vocabdeck
</a>
```

Untuk staging dan production, gunakan proyek/konfigurasi Site URL yang sesuai. Callback hanya menerima `invite`/`recovery` atau kode PKCE; URL tujuan tidak diambil dari input bebas pengguna. Tautan invalid mengarah ke login dengan pesan kesalahan.

## 5. Undang akun dan buat admin pertama

1. Supabase Dashboard → Authentication → Users → Invite user. Kirim undangan ke email Anda.
2. Buka email dan tentukan password minimal 12 karakter.
3. Trigger mengaktifkan profil hanya jika `invited_at` dan `email_confirmed_at` telah terisi. Role/status dari metadata publik diabaikan. User yang dibuat tanpa undangan tetap pending.
4. Salin UID akun Anda dari Dashboard, lalu jalankan satu kali di SQL Editor:

```sql
UPDATE vocabdeck.profiles
SET role = 'admin', updated_at = now()
WHERE id = '<UID-akun-Anda>'::uuid AND status = 'active';
```

5. Login kembali/buka ulang halaman. Menu admin akan tersedia.
6. Undang pengguna lain melalui Dashboard. `/admin/users` dapat menangguhkan atau mengaktifkan kembali akun yang sudah menerima undangan. Cocokkan UID jika display name masih kosong.

Undangan email programatik melalui aplikasi belum disediakan; `SUPABASE_SECRET_KEY` tidak diperlukan untuk alur MVP ini. Akun admin dikelola melalui Dashboard. Role biasa tidak dapat mempromosikan dirinya sendiri.

## 6. Aktifkan AI jika dibutuhkan

Fitur manual, impor CSV, dan review tidak membutuhkan AI. Untuk mengaktifkan:

```env
AI_PROVIDER=deepseek
AI_MODEL=deepseek-flash
DEEPSEEK_API_KEY=<isi-lokal>
AI_ENABLED=true
AI_USER_DAILY_LIMIT=10
AI_GLOBAL_DAILY_LIMIT=100
AI_GLOBAL_CONCURRENCY=5
```

Model default diverifikasi terhadap dokumentasi DeepSeek pada 24 November 2026. Model dapat diganti melalui environment; model yang dipilih harus mendukung Chat Completions dan JSON output.

Restart server sesudah mengubah environment. Admin dapat menurunkan batas, menetapkan kuota, atau mematikan AI di `/admin/usage`. Nilai `AI_ENABLED=false` pada server selalu menang. Kuota memakai UTC dan reset pukul 07.00 WIB; semua percobaan yang sudah direservasi, termasuk gagal, ikut dihitung. Ada batas 3 request/pengguna/menit, 20 request global/menit, dan satu request aktif/pengguna.

Tidak ada pemanggilan AI sampai pengguna menekan Buat preview. Hasil hanya masuk konten setelah pengguna memeriksa, memilih, dan menyimpan. Teks input tidak disimpan di log pemakaian. Token usage dicatat bila provider mengembalikannya; estimasi harga uang belum dihitung.

## 7. Deploy ke Vercel

1. Push repository ke remote Git milik Anda, lalu impor ke Vercel sebagai proyek Next.js. Repository lokal ini belum memiliki remote.
2. Pilih Node.js 24.x, install `npm ci`, build `npm run build`, output default Next.js. Build menggunakan Webpack; dev tetap menggunakan default Next.js.
3. Isi environment untuk deployment yang tepat. `NEXT_PUBLIC_APP_URL` harus sama dengan origin deployment, tanpa path. Tambahkan Supabase URL/key, runtime `DATABASE_URL`, dan konfigurasi AI. Jangan gunakan database production untuk preview cabang.
4. Terapkan `npm run db:migrate` satu kali dari pipeline dengan `DIRECT_URL` milik environment tujuan sebelum traffic dialihkan. Jangan menjalankan migrasi per request.
5. Sesuaikan Supabase Site URL, redirect allowlist, dan template email dengan domain deployment.
6. Jalankan pemeriksaan staging di [TESTING.md](TESTING.md). Simpan backup yang telah diuji pemulihannya sebelum mengundang pengguna nyata.

## Referensi resmi

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Template email Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Koneksi database Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma Client v7](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client)
- [Model DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/)
