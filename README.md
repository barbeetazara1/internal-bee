# Internal Bee — Portal Internal & Licensing

Portal operasional internal: CRM lead → client & project → lisensi API → tagihan (Bills). Dibangun sesuai PRD v1.1.

**Stack:** Next.js 15 (App Router, server actions) · React 19 · Prisma 6 · PostgreSQL · Tailwind CSS 3 · jose (JWT) · bcryptjs.

## Fitur

| Modul | Ringkasan |
|---|---|
| **Dashboard** | Ringkasan lead, deal, API key aktif, task, dan lisensi yang segera berakhir. |
| **Product Catalog** | Master produk: kode, tipe lisensi (Tahunan / Bulanan / One-time), harga dasar. |
| **Leads (CRM)** | Pipeline Baru → Dihubungi → Qualified → Proposal → Negosiasi → Closed Won / Lost. Produk di lead bisa diedit (produk, tipe lisensi, harga) sampai tahap Negosiasi. |
| **Closed Won** | Modal sistem pembayaran per produk, lalu otomatis membuat **Project + task board**, **API Key** per produk, dan **Bills**. |
| **Bills** | Tagihan hasil sistem pembayaran: Bayar Penuh, DP + Cicilan, Cicilan Sama Rata, atau Per Bulan (tanggal pembayaran pertama dipilih user, sisanya otomatis). Tandai lunas **wajib bukti** (PNG/JPG/PDF, maks. 5 MB). Invoice per bill (cetak/PDF). |
| **Demo** | Permintaan demo → license key sandbox berjangka waktu. |
| **Clients & Licenses** | Data client, lisensi Production dan Demo (refresh token, suspend, revoke). Key hanya ditampilkan sekali; di database hanya hash SHA-256. |
| **Projects** | Daftar (group by client), Kanban sprint, Gantt, status bar, smart button Bills, dan tombol **Termin Invoice** untuk pembayaran bertahap. |
| **Laporan** | Laporan finansial (khusus Super Admin). |
| **Settings** | General (bahasa Indonesia / English, langsung berubah tanpa refresh) dan Users (khusus Super Admin). |
| **Chatter** | Riwayat perubahan, komentar, @mention, dan notifikasi di tiap record. |
| **API verifikasi key** | `GET/POST /api/v1/verify` dengan header `x-api-key` (rate limit per key). |

Role: `SUPER_ADMIN`, `SALES`, `PROJECT` (RBAC di server — bukan hanya menyembunyikan menu).

## Menjalankan secara lokal

Prasyarat: **Node.js 20+** (disarankan LTS terbaru) dan **PostgreSQL 14+**.

```bash
git clone https://github.com/barbeetazara1/internal-bee.git
cd internal-bee
npm install                      # ikut menjalankan `prisma generate`

cp .env.example .env             # lalu isi DATABASE_URL dan AUTH_SECRET
createdb internal_bee            # atau buat database lewat tool PostgreSQL Anda

npm run db:push                  # membuat tabel dari prisma/schema.prisma
npm run db:seed                  # data contoh (user, produk, lead, dst.)
npm run dev                      # http://localhost:3400
```

Akun seed (password dev: `BeeDev#2026`):

| Email | Role |
|---|---|
| `admin@internalbee.local` | Super Admin |
| `sales@internalbee.local` | Sales |
| `project@internalbee.local` | Project |

> Akun dan password di atas **hanya untuk pengembangan lokal**. Jangan dipakai di server yang bisa diakses orang lain.

### Environment variable

| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Connection string PostgreSQL. |
| `AUTH_SECRET` | ya | Kunci penanda tangan token sesi (HS256). Buat dengan `openssl rand -base64 32`. Mengganti nilainya membuat semua sesi login keluar. |

### Script npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server di port 3400. |
| `npm run build` / `npm start` | Build produksi dan menjalankannya di port 3400. |
| `npm run db:push` | Sinkronkan skema Prisma ke database (tanpa file migrasi). |
| `npm run db:seed` | Isi data contoh (aman diulang; dilewati bila data lead sudah ada). |
| `npm run db:reset` | **Menghapus seluruh data** lalu seed ulang. Hanya untuk lokal. |

## Deploy

Aplikasi ini satu proses Node.js + satu database PostgreSQL. Panduan berikut untuk VPS/server Linux; konsepnya sama untuk platform lain.

### 1. Siapkan server

- Node.js 20+ dan PostgreSQL (atau database PostgreSQL terkelola).
- Buat database dan user khusus, mis. `internal_bee`.
- Domain + HTTPS (Nginx/Caddy sebagai reverse proxy — lihat langkah 5).

### 2. Ambil kode & konfigurasi

```bash
git clone https://github.com/barbeetazara1/internal-bee.git /srv/internal-bee
cd /srv/internal-bee
npm ci
cat > .env <<'EOF'
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/internal_bee?schema=public"
AUTH_SECRET="<hasil openssl rand -base64 32>"
EOF
chmod 600 .env
```

### 3. Siapkan database

```bash
npx prisma db push          # membuat/menyesuaikan tabel
```

Data awal untuk produksi:

- Jalankan `npm run db:seed` **hanya** bila Anda butuh data contoh. Seed membuat tiga akun dengan password dev yang publik — **ganti password semuanya** (Settings → Users → Ganti Password) atau hapus akun contoh sebelum dipakai sungguhan.
- Tanpa seed, Anda perlu membuat Super Admin pertama (mis. lewat `psql` dengan hash bcrypt, atau jalankan seed lalu ganti password dan hapus data contoh yang tidak perlu).

### 4. Build & jalankan

```bash
npm run build
npm start                    # port 3400
```

Agar tetap hidup setelah logout/restart, pakai process manager, mis. **systemd**:

```ini
# /etc/systemd/system/internal-bee.service
[Unit]
Description=Internal Bee
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/internal-bee
ExecStart=/usr/bin/npm start
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now internal-bee
```

(atau `pm2 start npm --name internal-bee -- start`).

### 5. Reverse proxy + HTTPS

Contoh Nginx (sertifikat bisa dari certbot):

```nginx
server {
  server_name portal.contoh.com;
  client_max_body_size 8m;            # unggah bukti pembayaran (maks. 5 MB)
  location / {
    proxy_pass http://127.0.0.1:3400;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 6. Update versi baru

```bash
cd /srv/internal-bee
git pull
npm ci
npx prisma db push           # baca dulu peringatannya (lihat catatan di bawah)
npm run build
sudo systemctl restart internal-bee
```

### Checklist sebelum go-live

- [ ] `AUTH_SECRET` acak dan unik, `.env` tidak ikut ter-commit (sudah di `.gitignore`).
- [ ] Password akun seed diganti / akun contoh dihapus.
- [ ] HTTPS aktif (lihat catatan cookie di bawah).
- [ ] Folder `storage/` ada di disk yang persisten dan masuk **backup** (berisi bukti pembayaran).
- [ ] Backup PostgreSQL terjadwal (`pg_dump`).

## Catatan penting

**Penyimpanan bukti pembayaran**
- File bukti tidak disimpan di database. Isinya diperiksa dari byte-nya (PNG/JPEG/PDF asli, bukan sekadar ekstensi), lalu disimpan di `storage/bill-proofs/`. Database hanya menyimpan nama, jenis, dan ukuran.
- Folder `storage/` ada di `.gitignore` dan hanya disajikan lewat `/api/bills/:id/proof` untuk Super Admin dan Sales yang sudah login. Di deploy berbasis container/serverless, pasang sebagai volume persisten.

**Skema database**
- Proyek memakai `prisma db push` (tanpa folder migrasi). Cocok untuk pengembangan, tetapi perubahan yang menghapus kolom (contoh: kolom skema tagihan yang sudah dibuang dari Product dan Lead) membutuhkan `--accept-data-loss`. Untuk produksi jangka panjang, sebaiknya beralih ke `prisma migrate` agar perubahan skema terdokumentasi dan bisa dibatalkan.

**Keamanan**
- Cookie sesi (`ib_session`, 8 jam) bersifat `httpOnly` + `sameSite=lax`, namun belum diberi flag `secure`. Tambahkan `secure: true` di `lib/auth.ts` begitu aplikasi hanya diakses lewat HTTPS.
- Rate limit pada `/api/v1/verify` bersifat in-memory per proses (cukup untuk satu instance). Untuk lebih dari satu instance atau trafik tinggi, pindahkan ke Redis.
- Token API hanya disimpan sebagai hash SHA-256; token mentah muncul sekali saat dibuat/di-refresh.

**Bahasa (i18n)**
- Terjemahan Indonesia ⇄ English dilakukan di sisi klien lewat kamus `lib/i18n-dict.ts` yang mencocokkan teks di layar. Teks baru yang ditambahkan ke kode perlu didaftarkan di kamus itu, kalau tidak tampil apa adanya. Data yang diketik user (nama produk, catatan, dll.) tidak diterjemahkan. Pilihan bahasa disimpan di cookie browser (`ib_lang`), bukan di akun.

**Aturan bisnis yang perlu diketahui**
- Harga di baris lead dianggap **total nilai kontrak**, kecuali sistem pembayaran **Per Bulan**: harga dianggap **per bulan** dan total = harga × jumlah bulan.
- DP + Cicilan: DP dibayar di tanggal pembayaran pertama, sisanya dibagi rata (sisa pembulatan di cicilan terakhir).
- Lead Closed Won lama yang belum punya bill menampilkan banner "Atur Pembayaran" untuk membuat bill-nya.
- "Terlambat" bukan status tersimpan: bill Belum Dibayar yang lewat jatuh tempo.
- Quotation (penawaran) sudah dihapus dari Lead; dokumen yang tersedia sekarang adalah Invoice per bill.

**Struktur kode (ringkas)**

```
app/(app)/…        halaman (server components) per modul
app/actions/…      server actions (mutasi data + validasi + riwayat)
app/api/…          route handler (verifikasi key, bukti pembayaran)
components/…       komponen UI bersama (DataTable, Select, DatePicker, dll.)
lib/…              auth, RBAC, otomatisasi Closed Won, pembayaran, i18n, util
prisma/            schema.prisma dan seed.ts
```

**Verifikasi key (contoh)**

```bash
curl -H "x-api-key: ib_live_..." http://localhost:3400/api/v1/verify
```
