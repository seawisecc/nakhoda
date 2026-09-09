@AGENTS.md

# Nakhoda

Pelacak portofolio pribadi Agus untuk saham AS dan kripto (broker: Pluang).
Satu pengguna, bukan produk komersial. Firebase project `nakhoda-porto`,
terpisah dari `hari-baik-7e56c` supaya data finansial pribadi tidak tercampur
data bisnis.

Live di **https://nakhoda.seawise.id**. **Reponya publik**
(`github.com/seawisecc/nakhoda`), jadi apa pun yang ditulis ke berkas repo
terbaca siapa saja. Angka portofolio yang sebenarnya tinggal di Firestore,
bukan di repo; jangan menambah data pribadi baru ke berkas mana pun tanpa Agus
memintanya secara eksplisit.

## Menjalankan

```bash
npm run dev            # pengembangan, localhost:3000
npm run build && npm start   # produksi
npm run verify         # lint + 196 tes + build. Jalankan sebelum bilang selesai.
```

Perintah lain: `npm run kunci` (simpan API key tanpa lewat riwayat shell),
`npm run saran` (tulis satu saran lewat Admin SDK), `npm run deploy-rules`,
`npm run palet` (gate kontras dan buta warna untuk seluruh palet).

**Kalau Agus minta rekomendasi atau riset, baca `RISET.md` dulu.** Aturannya
mengikat, termasuk bahwa "tidak ada yang layak hari ini" adalah jawaban yang
benar dan sering.

## Deploy

Push ke `main` men-deploy produksi sendiri lewat integrasi GitHub Vercel
(proyek `seawise/nakhoda`). Aturan Firestore tidak ikut terbawa push; itu
perlu `npm run deploy-rules` tersendiri setiap kali `firestore.rules` berubah.

**Author commit harus punya akses ke tim Vercel.** Git global laptop ini
memakai akun Ipay7 sementara tim Vercel dan reponya milik seawisecc, jadi repo
ini punya identitas lokal sendiri (`git config --local user.email
296332061+seawisecc@users.noreply.github.com`). Kalau identitas itu hilang,
push tetap sukses tapi deploy-nya berstatus `BLOCKED` sebelum build dimulai,
tanpa log build sama sekali.

Perlindungan Vercel dipasang `all_except_custom_domains`: URL `*.vercel.app`
terkunci SSO, domain kustomnya terbuka dan dijaga login Firebase app sendiri.
Artinya `curl` ke URL deployment akan kena 302 ke sso-api; pakai
nakhoda.seawise.id untuk memeriksa produksi.

## Bahasa dan gaya

- **Seluruh kode, komentar, dan teks antarmuka berbahasa Indonesia.** Nama
  variabel, fungsi, tipe, semuanya. Ini konsisten dan disengaja, bukan
  setengah-setengah.
- Nama koleksi Firestore tetap Inggris (`transactions`, `suggestions`) karena
  itu kontrak dengan security rules dan script. Peta namanya di
  `src/lib/data/koleksi.ts`.
- **Jangan pakai em dash** di teks mana pun, termasuk komentar.
- **Teks antarmuka pendek.** Agus sudah paham app ini alat bantu, bukan jaminan
  investasi; tidak perlu diulang di layar. Yang dipertahankan adalah peringatan
  yang menempel pada keadaan data ("perkiraan", "2 posisi belum punya harga"),
  bukan wejangan umum.
- Komentar menjelaskan **kenapa**, terutama kenapa pendekatan yang tampak lebih
  sederhana ditolak. Bukan mengulang apa yang sudah terbaca dari kodenya.

## Sistem desain

Papan instrumen, bukan kartu aplikasi. Seluruh aturannya ada di `globals.css`
dengan alasannya masing-masing; yang di bawah ini ringkasannya.

- **Hairline 1px, sudut nol, tanpa bayangan.** Struktur dibawa garis dan beda
  permukaan. Token radius semuanya `0px` kecuali chip status (`2px`), jadi
  kelas `rounded-*` tidak berpengaruh apa-apa dan sebaiknya tidak ditulis.
  Bayangan hanya untuk yang benar-benar mengambang (modal); `--nk-bayang-1`
  sengaja `none` supaya nilai kecil-tapi-ada tidak bocor balik ke panel.
- **Setiap label kecil pakai `.label-mikro`** (mono, huruf besar, tracking
  lebar). Label kecil yang tidak memakainya berarti kelupaan, bukan variasi.
- **Setiap nominal pakai `.angka`** (mono, tabular-nums).
- **`.angka-sorot` hanya untuk angka display**, satu sampai dua per layar
  (total portofolio, return bulan berjalan). Font dot-matrix Doto, di-host
  sendiri di `src/app/fonts/` lewat `next/font/local` supaya build tidak butuh
  jaringan. **Tidak pernah di bawah ~28px**: titiknya menempel dan 8 jadi mirip
  0. Angka tabel, baris posisi, dan ubin tetap `.angka`.
- **Sel bersebelahan memakai `.jala`**, bukan border per sel. Border per sel
  menghasilkan garis dobel di setiap pertemuan; `.jala` memakai latar yang
  menembus lewat jarak 1px, jadi persimpangannya tetap satu garis.
- **Merah adalah satu-satunya aksen, dan dia sewarna dengan rugi.** Ini
  disengaja: dua merah yang beda tipis di layar finansial lebih membingungkan
  daripada satu merah untuk dua peran yang tidak pernah bertemu. Aksen hanya
  menyentuh kerangka (logo, nav aktif, garis kepala panel). **Angka tidak pernah
  memakai aksen**, hanya `naik` / `turun` / `ink`. Lencana yang perannya netral
  (provenance, hitungan, tingkat "cukup") pakai `info` atau `peringatan`, jangan
  `aksen`; merah di situ terbaca sebagai alarm.
- **Arah untung-rugi tidak pernah dibawa warna saja.** Selalu ada tanda ▲/▼
  atau kata.
- **Dua tema, satu geometri.** Kertas adalah tema utama; tema gelap memakai
  tipografi dan bentuk yang sama, yang berbalik hanya tangga permukaannya.
- **Warna tidak boleh dikira-kira.** Palet lolos gate kontras teks 4,5:1
  terhadap setiap permukaan tempat teks itu dipakai, batas kontrol dan warna
  seri 3:1, serta pemisahan antar seri untuk semua pasangan di penglihatan
  normal, protanopia, dan deuteranopia. Kalau mengubah warna apa pun di
  `globals.css`, salin nilainya ke `scripts/validasi-palet.ts` lalu jalankan
  `npm run palet`. Satu pengecualian yang disengaja: hairline dekoratif tidak
  tunduk ke 3:1, karena WCAG 1.4.11 mengikat komponen yang harus dikenali,
  bukan garis pemisah. Yang tunduk 3:1 adalah `--nk-border-strong`, dipakai
  untuk tepi kontrol.

## Yang tidak boleh dilanggar

- **Semua uang dihitung di `src/lib/hitung/`, fungsi murni, tanpa React dan
  tanpa Firebase, dan semuanya punya tes.** Kalau menambah perhitungan uang,
  taruh di sana dan tulis tesnya. Tes ada di `src/lib/__tests__/`, runner
  seadanya tanpa framework.
- **Jangan pernah menebak angka finansial.** Tarif broker, harga stop, jumlah
  unit: kalau tidak diketahui, kembalikan null dan tandai di UI supaya Agus
  yang mengisi. Angka tebakan yang dilabeli rapi lebih berbahaya daripada
  kolom kosong.
- **Mata uang harus eksplisit di setiap perhitungan.** Posisi punya mata uang
  sendiri, sumber data harga selalu USD, mata uang dasar bisa IDR. Bug termahal
  di proyek ini adalah harga dolar yang tampil berlabel rupiah. Konversi lewat
  `konversi()` di `src/lib/hitung/uang.ts`, jangan menulis pengali sendiri.
- **Return bulanan pakai Modified Dietz**, bukan `(EMV-BMV)/BMV`. BMV butuh
  snapshot; kalau tidak ada, hasilnya ditandai `bmvPerkiraan` dan UI wajib
  menampilkan badge "perkiraan".
- **Kredensial tidak pernah masuk repo atau chat.** Service account key ada di
  `~/rahasia/nakhoda-admin.json`. `.env.local` sudah di `.gitignore`.
- **Win rate datang dari transaksi, bukan dari jurnal.** `src/lib/hitung/trade.ts`
  membangun siklus posisi: satu siklus mulai saat kepemilikan naik dari nol dan
  selesai saat kembali ke nol. Jurnal tetap memegang R-multiple dan ekspektansi,
  karena stop yang direncanakan memang cuma ada di sana. Penjualan yang
  pembeliannya tidak pernah tercatat ditandai `basisTidakLengkap` dan
  **dikeluarkan** dari statistik: satu kemenangan palsu 100% merusak win rate
  tanpa terlihat rusak.
- **Saran beli/jual wajib punya pembatal thesis, dan R:R minimal 1,5.**
  Keduanya ditolak keras di `scripts/tambah-saran.ts`, bukan sekadar
  diperingatkan. Tanpa pembatal, tiga bulan kemudian tidak ada yang bisa
  membedakan "thesisnya rusak" dari "harganya cuma bergerak".
- **Realisasi bulanan bukan pengganti Modified Dietz.** `realisasiPeriode()`
  cuma menghitung yang sudah dikunci lewat penjualan, diukur terhadap modal
  bersih supaya targetnya tidak ikut bergerak setiap kali harga pasar bergerak.
  Keduanya memang akan berbeda, dan itu bukan kontradiksi.

## Struktur

```
src/app/            Halaman App Router + route API (harga, kurs, ohlc)
src/app/fonts/      Doto (dot-matrix) di-host sendiri, dipakai .angka-sorot
src/components/ui/  Kit dasar: kartu, tombol, isian, tabel, grafik, panel
src/components/shell/   Rel samping, bilah atas, bilah bawah, layar masuk
src/components/formulir/  Form transaksi, modal, jurnal, kalkulator, tempel saran
src/lib/hitung/     Logika murni: posisi, trade, kinerja, risiko, tinjauan,
                    level, biaya, tonggak
src/lib/data/       Penyedia data, adaptor lokal dan Firestore, ekspor, contoh
scripts/            tambah-saran, tambah-alokasi, set-kunci, deploy-rules,
                    buat-ikon, validasi-palet
RISET.md            Aturan riset lengkap, dibaca saat Agus minta rekomendasi
src/lib/prompt-saran.ts   Versi ringkasnya, di balik tombol "Salin prompt"
```

App jalan tanpa konfigurasi apa pun dalam **mode lokal** (localStorage), dan
beralih ke Firestore begitu `.env.local` terisi. Jangan hapus jalur lokal itu;
dia yang membuat app bisa dinilai tanpa setup.

## Jebakan yang sudah pernah menggigit

- **CSS di luar `@layer` mengalahkan seluruh utility Tailwind.** Satu aturan
  `* { border-color }` tanpa layer pernah mematikan setiap utility warna border
  di seluruh app, tanpa error, cuma border yang warnanya seragam di mana-mana.
  Semua di `globals.css` harus di dalam `@layer base` atau `@layer components`.
- **TradingView menimpa tinggi kontainernya sendiri jadi `100%`.** Tinggi harus
  dipasang di pembungkus luar, bukan di kontainer widget.
- **Kanvas lilin TradingView tidak tergambar di browser otomasi.** Terjadi juga
  di situs TradingView sendiri, jadi jangan mengejarnya sebagai bug; verifikasi
  di browser sungguhan.
- **`claude -p` butuh `--allowedTools WebSearch WebFetch`.** Tanpa itu Claude
  tidak punya akses data terkini dan, dengan benar, menolak mengarang: yang
  keluar array kosong terus-menerus.
- **CoinGecko gratis gampang kena 429** saat diuji berulang. Route OHLC
  membedakan rate limit dari ticker tidak dikenal; jaga pembedaan itu.
- **Service worker sisa build produksi mengunci bundel lama di dev.** Kalau
  `npm start` pernah jalan sekali di localhost:3000, SW-nya tetap terdaftar di
  origin itu dan melayani `npm run dev` berikutnya. Navigasi dilayani jaringan
  jadi HTML-nya baru, tapi `/_next/static/` dilayani cache-first jadi JS-nya
  lama: halaman tampil normal, data mengalir, konsol bersih, dan perubahan kode
  tidak muncul sama sekali. Reload biasa tidak menolong, cuma hard reload.
  `DaftarSW` sekarang membatalkan SW dan menghapus cache-nya saat di dev, tapi
  kode itu sendiri baru bisa jalan setelah satu hard reload. Cara memastikan
  bukan cuma menebak: `navigator.serviceWorker.getRegistrations()` di konsol,
  dan cek apakah kelas CSS terbaru benar-benar ada di DOM.
- **Metadata berbasis berkas di App Router mengalahkan objek `metadata`.**
  Menaruh `favicon.ico` di `src/app/` akan membuang seluruh `metadata.icons`
  berikut ikon SVG dan apple-touch yang ada di dalamnya. Karena itu faviconnya
  ada di `public/`, dan daftar ikonnya tetap dipegang layout.
- **Lambang yang bagus di 512px belum tentu terbaca di 16px.** Gores 30 di
  viewBox 512 jatuh jadi 0,94px dan hilang setengah ke antialiasing. Ada dua
  sumber: `ikon.svg` untuk ukuran besar, `ikon-kecil.svg` untuk ukuran tab.
  Keduanya dirender `npx tsx scripts/buat-ikon.ts`.
- **Tampilan ponsel tidak bisa diuji dengan mengubah ukuran jendela.** Kalau
  jendelanya maximized, Chrome mengabaikan permintaan resize sementara tetap
  melaporkan sukses, dan `window.innerWidth` tidak berubah. Cara yang jalan:
  muat app di dalam `<iframe width="390">`, karena media query mengikuti
  viewport iframe.

## Data Agus

Keadaan portofolio jangan ditebak dari berkas mana pun di repo ini. Baca dari
Firestore: posisi diturunkan dari `transactions`, kas dan modal dari
`capitalFlows`, harga dari `priceCache`.

Transaksi diimpor dari tangkapan layar Pluang, bukan dari ekspor resmi, dan
ada dua mutu yang berbeda di dalamnya. Impor 1 Agu 2026 berasal dari **halaman
muka**, jadi nilai belinya pasti tapi jumlah unitnya diturunkan. Yang datang
dari **struk order detail** punya qty pasti broker berikut dua baris fee-nya.
Kalau Agus mengirim tangkapan layar, mintalah struk detail, bukan halaman muka.
Setiap koreksi qty ditandai di `catatan` transaksinya.

Modal awal Rp 7.897.545 tanggal 1 Agu 2026 adalah hasil hitung mundur, bukan
riwayat asli. Konsekuensinya masih menggantung: **angka kas belum pernah
dicocokkan dengan saldo asli Pluang.** Kas diturunkan dari modal dikurangi
belanja ditambah hasil jual, jadi dia cuma sebenar hitung mundur itu. Setiap
usulan alokasi berdiri di atasnya, dan itu harus dikatakan setiap kali.

**Tarif Pluang, diturunkan dari struk asli 8 Sep 2026:**

- Saham AS: fee transaksi **0,30%** dari nilai order, plus pajak dan pihak
  ketiga **~0,10%** dengan lantai sekitar $0,04. All-in 0,40 sampai 0,42% untuk
  order di atas $70, tapi bisa 0,9% untuk order $6. `feePersenSaham` sudah
  diisi 0,4 dari angka ini. Lantai itu yang membuat order kecil mahal secara
  persentase, dan itu tidak terlihat kalau fee dimodelkan sebagai persen datar.
- Kripto: baris fee-nya nyaris nol (Instant Buy SOL 9 Sep: fee Rp 0, pajak
  Rp 54 atas Rp 499.944). Biaya sebenarnya ada di **selisih harga beli-jual**,
  dan itu baru bisa diukur saat menjual, bukan saat membeli.
- Instant Buy kripto berdenominasi **rupiah**. Masuk apa adanya dengan
  `mataUang: IDR`, jangan dikonversi manual ke dolar.

**Celah yang belum ditutup:** dividen belum dimodelkan (Agus rutin menerimanya
dari KMI, NVDA, MSFT), dan laba realisasi penjualan GE 8 Jun 2026 belum
tercatat karena harga belinya tidak diketahui, jadi siklusnya ditandai
`basisTidakLengkap` dan tidak ikut win rate.
