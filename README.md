# POS Pangkas Rambut

Sistem kasir untuk pangkas rambut: layanan + produk ritel dalam satu struk, komisi
per barber, antrean & jadwal, laporan Z, dan mode luring dengan antrean sinkronisasi.

Stack: **SvelteKit 3 (Svelte 5 runes) + TypeScript + Tailwind v4**, backend
**Firebase** (Firestore + Cloud Functions + Hosting).

> **Status: kode siap, deploy tertahan hak akses.** Seluruh sambungan ke
> Firebase dan migrasi data contoh sudah selesai ditulis dan terverifikasi di
> browser (mode mock). Yang belum bisa dilakukan adalah `firebase deploy` ke
> project `danangprass-777` karena akun CLI yang login
> (`test.danangprass@gmail.com`) belum punya peran IAM di project tersebut.
> Detail dan cara mengatasinya ada di bagian
> [Deploy ke Firebase](#deploy-ke-firebase).

## Menjalankan

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node 24 LTS terpasang manual
cd barberpos
npm install
npm run dev        # http://127.0.0.1:5173
```

Build & cek tipe:

```bash
npm run check      # svelte-check (client)
npm run build      # output ke ./build (SPA statis + 200.html fallback)
cd functions && npm run build   # output ke functions/lib (Cloud Functions)
```

### Dua mode backend

| Mode | Cara | Data disimpan di |
|---|---|---|
| **Firebase** (default) | `VITE_USE_MOCK` tidak di-set | Firestore + Cloud Functions |
| **Mock** | `VITE_USE_MOCK=true npm run dev` | IndexedDB browser |

Mode mock bukan sisa arsip: ia adalah **implementasi kedua** dari kontrak
`PosRepository` yang sama, sehingga UI, store, dan komponen tidak berubah
sama sekali. Berguna untuk pengembangan UI tanpa bergantung pada cloud, dan
sekaligus membuktikan seam-nya benar-benar bekerja untuk dua backend.

```bash
VITE_USE_MOCK=true npm run dev -- --host 127.0.0.1 --port 5174
```

### Login demo

Pilih nama → masukkan PIN **`123456`** (sama untuk semua staf demo, mode mock).

| Staf | Peran | Cabang |
|---|---|---|
| Andi Saputra | Pemilik | Sudirman, Kemang |
| Sari Wijaya | Manajer | Sudirman |
| Rahmat Hidayat | Tukang Cukur | Sudirman, Kemang |
| Bayu Nugroho | Tukang Cukur | Sudirman |
| Joko Prasetyo | Tukang Cukur | Kemang |

Di mode Firebase, PIN **diverifikasi di server** oleh Cloud Function
`signInWithPin` dan diganti custom token — browser tidak pernah menghitung
atau membandingkan hash PIN. Hash PIN hanya disimpan di `staffSecrets/{id}`,
koleksi yang **tidak bisa dibaca klien mana pun** (bahkan manajer).

## Arsitektur

```
src/
  lib/
    firebase/
      config.ts               konfigurasi web Firebase (bisa di-override env)
      client.ts               initializeApp + Firestore (persistent cache) + Auth + Functions
    data/
      repository.ts           kontrak — satu-satunya seam backend
      index.ts                TITUK PERGANTIAN mock ↔ Firebase
      mock/                   implementasi IndexedDB + seed
      firebase/               implementasi Firestore + callable
      local/outbox.ts         antrean luring (device-local, IndexedDB)
      cache.ts                mirror reaktif repository
    domain/
      sales.ts                orkestrator komisi/penomoran/stok + cabang online/offline
      reports.ts              agregasi, Z-report, ekspor CSV
    utils/
      format.ts               rupiah, tanggal & jam (zona waktu toko)
      receipt.ts              format nomor struk
  routes/
    login/                   pilih staf + PIN
    (app)/                   shell + dashboard, sell, queue, catalog,
                             customers, reports, branches, settings
shared/
  sample-data.ts              dataset contoh kanonik (dipakai mock + Firestore)
  time.ts                     helpers zona waktu bisnis (Asia/Jakarta)
functions/
  src/index.ts                callable: signInWithPin, commitSale, syncPendingSales,
                              setStaffPin, seedDemoData, ping
  src/seed.ts                 migrasi dataset contoh ke Firestore
  src/pin.ts                  hash SHA-256 + salt sisi server
firestore.rules               aturan akses per cabang
firestore.indexes.json        index komposit untuk query laporan
firebase.json                 konfigurasi hosting/functions/firestore
```

### Kontrak backend

`src/lib/data/repository.ts` mendefinisikan `PosRepository`. Satu baris
menentukan seluruh aplikasi:

```ts
// src/lib/data/index.ts
export const repo: PosRepository = useMock ? mockRepository : firebaseRepository;
```

Operasi yang Wajib lewat server (bisa dimanipulasi dari browser bila tidak):

1. `commitSale` — server calculates ulang harga tiap baris dari katalog,
   mengabaikan harga yang dikirim klien.
2. Penomoran struk — transaksional lewat `counters/{branchId}_{yyyymmdd}`,
   menghasilkan `INV/{KODE}/{YYYYMMDD}/{seq}`.
3. `syncPendingSales` — idempoten lewat `clientId`; retry tidak pernah
   menghasilkan struk ganda.
4. Hash PIN — disimpan server-side, tidak pernah dikirim ke klien.

Aturan Firestore mengunci `sales`, `stockMovements`, dan `counters` untuk
tulis-buku saja; klien membaca, server menulis.

### Zona waktu bisnis

Semua batas hari memakai **waktu toko (`Asia/Jakarta`)**, bukan jam perangkat
maupun jam UTC server — lewat `shared/time.ts`.

Ini penting karena browser bisa di WIB sementara Cloud Functions jalan di UTC.
Dengan pemotongan hari berbasis UTC, transaksi yang dibuat setelah pukul 07.00
WIB jatuh ke ember "kemarin", nomor struknya bertanggal berbeda dari tanggal
yang tercetak di struk, dan laporan harian ikut meleset.

Konsekuensinya:

- Nomor struk, filter "hari ini", dan dokumen counter memakai hari kalender toko.
- Jam yang ditampilkan (struk, antrean, laporan) juga memakai waktu toko, jadi
  perangkat yang di zona waktu lain tetap melihat jam yang sama dengan kasir.
- Input `datetime-local` (janji temu) dibaca dan ditulis sebagai waktu toko.

### Luring & sinkronisasi

```
online  → struk langsung jadi final, nomor asli, stok langsung berkurang
offline → tulis lokal + masuk outbox (clientId sebagai idempotency key)
reconnect → drainOutbox(): nomor struk asli → stok → tandai synced
```

Outbox drain otomatis saat event `online`, saat startup tab, atau manual dari
Pengaturan. Batasan yang perlu diterima: stok luring bersifat *eventually*
correct, bukan *instantly*. Dua cabang bisa menjual unit terakhir yang sama
saat luring; penyelesaiannya last-write-wins dan ditandai sebagai selisih
(`stockShortfall`) supaya pemilik bisa rekonsiliasi.

### Modul aplikasi

| Modul | Isi |
|---|---|
| **Kasir** | pilih barber → pilih layanan/produk → keranjang → bayar (Tunai / QRIS manual) → struk 58mm |
| **Antrean & Jadwal** | papan antrean (Terjadwal / Datang / Menunggu / Dilayani) + daftar janji temu, dan tombol pelanggan datang cepat |
| **Katalog** | layanan (durasi, komisi %) & produk (SKU, barcode, harga modal, stok, batas menipis) |
| **Pelanggan** | nama (wajib) + HP (opsional), riwayat kunjungan, total belanja |
| **Laporan** | penjualan harian, Laporan Z, kinerja per barber, layanan & produk terlaris, per metode bayar, per cabang, ekspor CSV |
| **Cabang** | kelola cabang, staf, peran, cabang yang boleh diakses, reset PIN |
| **Pengaturan** | bahasa, backend, koneksi/outbox, migrasi data contoh, header/footer struk, batas stok bawaan |

## Menguji dengan emulator (sebelum deploy)

Kode Cloud Functions dan security rules bisa diuji **lokal** tanpa menyentuh
project produksi. Ini yang menangkap bug yang tidak akan terlihat dari
`svelte-check` — misalnya urutan read/write di dalam transaksi Firestore, atau
rules yang menolak query list.

Butuh JDK 21+ untuk Firestore emulator:

```bash
brew install openjdk@21
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
```

Jalankan emulator + smoke test:

```bash
# terminal 1
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
npx firebase-tools@latest emulators:start \
  --only firestore,auth,functions --project demo-danangprass

# terminal 2
node scripts/emulator-smoke.mjs
```

`scripts/emulator-smoke.mjs` menjalankan 35 pemeriksaan dan keluar dengan kode
non-nol bila ada yang gagal:

- `seedDemoData` menulis dataset contoh dan **menolak** jalan kedua kali
- `staffDirectory` bisa dibaca tanpa login; `staffSecrets` dan `staff` tidak
- PIN salah ditolak; PIN benar mengembalikan custom token dengan claim
  `role` dan `branchIds`
- klien **tidak bisa** menulis `sales` atau menyentuh `counters`
- `commitSale` mengabaikan harga yang dimanipulasi klien dan menghitung
  kembalian serta komisi di server
- mengirim `clientId` yang sama dua kali **tidak** menggandakan penjualan
  maupun mengurangi stok lagi
- barber satu cabang hanya melihat cabang-nya, dan tidak bisa menjual ke
  cabang lain
- nomor struk berurutan dan tanggalnya memakai hari kalender toko

> Jalankan ulang script ini setiap kali menyentuh `functions/` atau
> `firestore.rules`. Emulator memuat ulang kode yang dibangun, jadi remember
> `npm run build` di `functions/` lebih dulu.

## Deploy ke Firebase

### 1. Plansyen: aktifkan Blaze (wajib untuk Cloud Functions)

> **Penting:** deploy Cloud Functions **wajib** memakai plan **Blaze
> (pay-as-you-go)**. Spark (gratis) tidak bisa deploy functions sama sekali:
> pipeline deploy membangun lewat Cloud Build dan Artifact Registry, dan kedua
> API itu tidak bisa diaktifkan di luar Blaze. Semua versi firebase-tools
> (9 sampai 15) menegakkan aturan yang sama, jadi ini bukan batasan versi
> tool.
>
> Firebase sering terlihat mengizinkan "free trial" untuk functions, tetapi
> kredit trial tersebut sudah dihentikan — Functions kini selalu butuh Blaze.

Buka <https://console.firebase.google.com/project/danangprass-777/usage/details>
→ **Upgrade** → pilih **Blaze (pay-as-you-go)** → hubungkan atau buat billing
account.

Blaze punya kuota gratis, dan bisa dipasang batas anggaran (budget alert) di
bagian **Usage & billing** supaya tidak ada tagihan tak terduga. Biaya yang
muncul setelah kuota habis adalah pemakaian Cloud Functions (invokasi, waktu
eksekusi, dan transfer data keluar) — untuk satu toko pangkas rambut, pemakaian
ini biasanya jauh di bawah kuota gratis.

Yang **sudah** ter-deploy tanpa Blaze: Firestore (database + rules + index) dan
Hosting.

### 2. Pastikan API aktif

Di project `danangprass-777`, aktifkan **Cloud Firestore**, **Cloud Functions**,
**Firebase Hosting**, dan **Firebase Authentication** (Custom Token — tidak perlu
provider email/password). Cloud Firestore dan Cloud Functions akan diaktifkan
otomatis oleh CLI saat deploy.

### 3. Pastikan hak akses

Akun yang harus punya peran: **Editor** (atau Owner) plus
`roles/serviceusage.serviceUsageConsumer` di project `danangprass-777`.

Buka <https://console.developers.google.com/iam-admin/iam?project=danangprass-777>
→ **Grant access** → tambahkan akun yang dipakai CLI sebagai **Editor**
(atau login memakai akun pemilik project). Alternatifnya, jalankan:

```bash
npx firebase-tools@latest login            # dengan akun pemilik project
npx firebase-tools@latest use --add danangprass-777
```

Tanpa langkah ini, `firebase deploy` gagal dengan HTTP 403:

```
Error: Request to https://firestore.googleapis.com/v1/projects/danangprass-777/databases
had HTTP Error: 403, The caller does not have permission
```

### 4. Deploy

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd functions && npm run build && cd ..
npx firebase-tools@latest deploy \
  --only functions,firestore:rules,firestore:indexes,hosting \
  --project danangprass-777
```

Cloud Functions memakai region `asia-southeast2` (dekat Jakarta).

### 4. Migrasi data contoh

Ada dua cara, tergantung apakah functions sudah ter-deploy.

**A. Lewat Cloud Function** (butuh plan Blaze). Masuk ke aplikasi (mode
Firebase) → **Pengaturan → Backend data → Impor data contoh**, lalu masukkan
PIN yang mau dipakai untuk seluruh staf.

Atau lewat CLI:

```bash
npx firebase-tools@latest functions:call seedDemoData \
  --project danangprass-777 --data '{"pin":"123456"}'
```

**B. Ganti PIN semua staf** (tidak butuh Cloud Functions ter-deploy). Script ini
hanya menulis ulang `staffSecrets` — salt dan hash baru — tanpa menyentuh data
lain:

```bash
node scripts/set-all-pins.cjs 123456     # PIN sebagai argumen
# atau:  SEED_PIN=4321 node scripts/set-all-pins.cjs
```

Hash-nya dibuat oleh helper yang sama dengan yang dipakai server, jadi
nilainya persis yang akan diterima `signInWithPin`.

**C. Seed ulang** (butuh data kosong). `scripts/seed-live.cjs` menulis seluruh
dataset — katalog, pelanggan, janji temu, dan riwayat penjualan — memakai
kredensial OAuth milik Firebase CLI, sehingga admin SDK bisa menulis langsung
ke Firestore tanpa deploy function:

```bash
node scripts/seed-live.cjs
# PIN lain:  SEED_PIN=4321 node scripts/seed-live.cjs
```

Pastikan `firebase login` sudah dijalankan lebih dulu, dan `functions/` sudah
di-build (`cd functions && npm run build`).

Keduanya menulis dataset yang persis sama — semuanya memakai
`shared/sample-data.ts`, sehingga laporan terlihat sama baik di mock maupun
Firestore. Riwayat 7 hari penjualan, janji temu hari ini, katalog, pelanggan,
dan counter harian ikut terbawa.

> Fungsi `seedDemoData` **menolak jalan** kalau koleksi `staff` sudah berisi
> data, jadi tidak mungkin menimpa toko yang sudah jalan. Perilaku yang sama
> berlaku untuk `scripts/seed-live.cjs`.

## Catatan teknis

- **SPA penuh** (`ssr = false`). Adaptor statis dengan `fallback: '200.html'`
  supaya `/sell` dan `/queue` bertahan saat hard refresh atau cold start luring.
- **Service worker** hanya menyimpan app shell, tidak pernah data bisnis —
  IndexedDB + repository tetap satu-satunya sumber kebenaran sinkronisasi.
- **Alias import SvelteKit 3** memakai `#lib`, bukan `$lib`. `tsconfig.json`
  menambahkan `paths` eksplisit supaya editor dan `svelte-check` agree dengan
  bundler. `shared/` memakai alias `#shared/*`.
- **Rupiah** adalah integer penuh di seluruh kode — tidak ada sen di mana pun.
- **Cloud Functions** dikompilasi sebagai CommonJS dengan `rootDir: ..`, jadi
  `shared/` ikut ter-build ke `functions/lib/shared/` dan di-require relatif.
- **PIN tidak pernah ada di source yang dikirim ke browser.** `shared/sample-data.ts`
  tidak memuat PIN; pemanggil meneruskannya ke fungsi seed.
- **Query cabang wajib menyaring `branchId`.** Rules memakai
  `resource.data.branchId`, dan Firestore hanya bisa membuktikannya untuk query
  list bila query itu sendiri memfilter field tersebut. Karena itu
  `listSales`, `listAppointments`, dan `listStockMovements` memakai
  `where('branchId', 'in', ...)` dari claim token — bukan sekadar optimalisasi,
  tanpa itu seluruh query ditolak.
- **Transaksi Firestore harus read-sebelum-write.** `commitSale` membaca
  counter dan level stok lebih dulu, baru menulis; Campuran `tx.get` setelah
  `tx.set` melempar error saat runtime, bukan saat compile. Smoke test
  menangkap ini.
- **Ukuran data.** Pembacaan masih tanpa pagination: satu kali boot menarik
  seluruh koleksi yang boleh diakses pengguna. Pada dua cabang dengan sekitar
  20 penjualan per hari ini masih aman, tetapi `getDocs` punya batas 8 MB —
  query penjualan perlu dipecah per periode sebelum data tumbuh besar.
- **Emulator memakai port non-default** (Firestore `8081`, UI `4001`) karena
  `8080` dipakai OrbStack di mesin ini.
