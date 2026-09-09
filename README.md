# Nakhoda

Pelacak portofolio pribadi untuk saham AS dan kripto. Satu pengguna, satu
tujuan: tahu persis di mana posisi modalmu, seberapa jauh dari target, dan
apakah keputusan tradingmu benar-benar bekerja atau cuma sedang beruntung.

Bukan produk komersial Seawise. Ini alat pribadi, dan disarankan memakai
**project Firebase terpisah** dari Haribaik supaya data finansial pribadi tidak
tercampur dengan data bisnis.

---

## Yang bisa dilakukan

| Halaman | Isinya |
|---|---|
| **Dasbor** | Total portofolio, progres ke target kekayaan, return bulan berjalan, alokasi aset, grafik nilai 90 hari |
| **Posisi** | Posisi aktif dan tertutup, biaya rata-rata, P&L belum dan sudah terealisasi |
| **Transaksi** | Riwayat dan form input beli/jual. Semua angka lain diturunkan dari sini |
| **Modal** | Modal awal, setoran, penarikan. Yang membuat angka return jujur |
| **Jurnal** | Thesis teknikal dan fundamental per trade, R:R, hasil dalam kelipatan R, pelajaran |
| **Tinjauan** | Apa yang perlu diputuskan hari ini: stop terlampaui, target tersentuh, posisi tanpa rencana keluar, konsentrasi, jarak ke target bulanan |
| **Saran AI** | Hasil riset yang ditulis Claude Code langsung ke Firestore |
| **Chart & TA** | Widget TradingView per ticker, dengan RSI dan MACD |
| **Pengaturan** | Target, mata uang dasar, tema, ekspor/impor, hapus data |

Tampilannya papan instrumen: hairline 1px, sudut nol, label mikro monospace
huruf besar, dan seluruh nominal memakai monospace tabular. Satu sampai dua
angka display per layar (total portofolio, return bulan berjalan) memakai font
dot-matrix, seperti papan angka. Tema kertas adalah
tampilan utamanya; tema gelap memakai geometri dan tipografi yang sama, hanya
tangga permukaannya yang berbalik, plus opsi ikut sistem. Bisa dipasang ke layar
utama HP sebagai PWA.

---

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000. **Tanpa konfigurasi apa pun, app langsung jalan
dalam mode lokal**: data disimpan di browser itu saja. Di Pengaturan ada tombol
"Muat data contoh" kalau kamu mau melihat dasbornya terisi dulu sebelum
memasukkan angka sungguhan.

Mode lokal tidak tersinkron antar perangkat dan hilang kalau data situs
dibersihkan. Untuk pemakaian sungguhan, lanjut ke bagian berikut.

---

## Menyalakan Firebase

### 1. Buat project

Di [Firebase Console](https://console.firebase.google.com), buat project baru,
terpisah dari project bisnis. Lalu:

- **Firestore Database** → Create database → mode production
- **Authentication** → Sign-in method → aktifkan **Email/Password**
- **Authentication** → Users → **Add user**, isi email dan kata sandimu.
  Hanya akun ini yang akan bisa masuk; app tidak punya halaman daftar.

### 2. Isi .env.local

```bash
cp .env.example .env.local
```

Nilai Firebase diambil dari **Project settings → Your apps → Web app**. Kalau
belum ada web app, buat satu (ikon `</>`).

Nilai `NEXT_PUBLIC_*` ikut terkirim ke browser, dan itu memang wajar: yang
melindungi datamu adalah Firebase Auth dan `firestore.rules`, bukan
kerahasiaan nilai-nilai itu.

### 3. Terbitkan aturan keamanan

**Wajib, sebelum di-deploy ke internet.** Tanpa ini, siapa pun yang tahu
konfigurasi Firebase bisa membaca seluruh data finansialmu.

```bash
npx firebase-tools login
npm run deploy-rules
```

Aturannya ada di `firestore.rules`: tolak-dulu, setiap koleksi disebut satu per
satu, dan setiap dokumen hanya bisa dibaca-tulis oleh pemilik `uid`-nya.

### 4. Kunci Finnhub untuk harga saham

Daftar gratis di [finnhub.io](https://finnhub.io/register), ambil kuncinya di
[dashboard](https://finnhub.io/dashboard), lalu:

```bash
npm run kunci
```

Kuncinya diketik dengan gema dimatikan, jadi tidak muncul di layar, tidak masuk
`~/.zsh_history`, dan tidak tertinggal di scrollback terminal. Menempelkannya
sebagai argumen perintah akan meninggalkan jejak di ketiganya. Sebelum
disimpan, kuncinya diuji ke Finnhub, karena kunci yang salah ketik akan
menyamar sebagai "harga saham tidak pernah ter-update" berhari-hari kemudian.

Kunci ini hanya dibaca di sisi server dan tidak pernah sampai ke browser.
Kripto (CoinGecko) dan kurs (ExchangeRate-API) tidak butuh kunci apa pun.

---

## Menulis saran dari Claude Code

Alurnya: minta analisis ticker di sesi Claude Code, lalu hasilnya ditulis
langsung ke Firestore sebagai catatan terstruktur. Entri muncul di app secara
realtime, di HP maupun laptop, tanpa refresh.

```bash
npm run saran -- \
  --ticker NVDA \
  --rekomendasi beli \
  --teknikal "Breakout dari konsolidasi tiga minggu, volume konfirmasi" \
  --fundamental "Guidance dinaikkan dua kuartal beruntun" \
  --entry 228,45 --stop 210 --target 250 \
  --pembatal "Tutup mingguan di bawah 210, atau guidance dipangkas" \
  --horizon 21 --rujukan "https://sumber1,https://sumber2"
```

Wajib: `--ticker`, `--rekomendasi` (beli / tahan / jual / pantau), dan
`--pembatal` untuk rekomendasi beli/jual.
Opsional: `--teknikal --fundamental --entry --stop --target --horizon --rujukan
--jenis --mata-uang --tanggal`.

Script menolak dua hal, dan menolaknya benar-benar, bukan memperingatkan:

- **Hipotesis beli/jual tanpa `--pembatal`.** Tanpa pembatal, tiga bulan lagi
  tidak ada yang bisa membedakan "thesisnya rusak" dari "harganya cuma
  bergerak", dan saran seperti itu tetap ikut dihitung di win rate seolah-olah
  setara dengan yang bisa dinilai.
- **Rasio imbalan terhadap risiko di bawah 1,5.** Batasnya ada di aturan riset,
  dan aturan yang tidak pernah menolak apa pun bukan aturan.

Perlu dua hal di `.env.local`:

```
NAKHODA_UID=<uid kamu, dari Console > Authentication > Users>
GOOGLE_APPLICATION_CREDENTIALS=/jalur/di/luar/repo/nakhoda-admin.json
```

Service account key diambil dari **Project settings → Service accounts →
Generate new private key**.

> **Ini rahasia sungguhan.** Admin SDK melewati seluruh aturan keamanan, jadi
> siapa pun yang memegang berkas ini bisa membaca dan menulis semua datamu.
> Simpan di luar folder repo. `.gitignore` sudah memblokir pola nama yang umum,
> tapi jangan bergantung pada itu.

Setelah bertindak atau memilih tidak, tandai status saran di app. Itulah yang
membuat dasbor bisa membandingkan win rate saran AI dengan keputusanmu sendiri,
bukan sekadar menurutinya buta-buta.

---

## Meminta riset

Riset selalu dimulai dari terminal, dalam sesi interaktif.

**Lewat terminal.** Halaman Saran menampilkan satu perintah siap tempel yang
sudah berisi keadaan portofoliomu saat itu. Salin, tempel ke terminal, dan
Claude Code akan meninjau posisimu lalu menunjukkan rencananya sebelum
menyimpan apa pun.

Dulu ada jalur kedua: tombol "Minta riset" di app yang menitipkan permintaan ke
Firestore, lalu watcher di laptop mengerjakannya di latar. Itu sudah dibuang.
Alasannya bukan karena tidak jalan, tapi karena yang paling berharga dari riset
ini justru kesempatan membantah hasilnya sebelum apa pun tersimpan, dan itu
hanya ada di sesi interaktif. Watcher yang berjalan diam-diam menghasilkan
saran yang tidak pernah dilawan siapa pun.

**Tempel dari AI lain.** Halaman Saran punya tombol "Tempel dari AI lain":
tempel mentahan dari ChatGPT, Gemini, atau siapa pun apa adanya. Nakhoda
menguraikannya jadi tabel entry, stop, target, dan R:R yang bisa disunting
sebelum disimpan. Tabel markdown, JSON, dan paragraf biasa semuanya dicoba.

Yang tidak ketemu tidak ditebak: field kosong ditandai dan dikembalikan
kepadamu untuk diisi. Menebak harga stop dari konteks adalah cara paling cepat
membuat angka yang salah terlihat resmi. Tersedia juga prompt siap salin yang
membuat AI mana pun membalas dalam bentuk tabel yang terurai bersih.

Karena tiap saran menyimpan sumbernya, halaman Jurnal bisa membandingkan siapa
yang lebih sering benar dari waktu ke waktu.

Satu riset memakan beberapa menit dan menjalankan proses Claude Code penuh.
Tutup dulu aplikasi lain yang berat sebelum menjalankannya.

Tiap saran menyimpan tiga hal yang membuatnya bisa dinilai belakangan, bukan
cuma dibaca sekali: **pembatal thesis** (peristiwa atau level yang membuatnya
salah), **horizon** dalam hari, dan **rujukan** berupa URL sumber angkanya.
Halaman Saran menampilkan ketiganya, dan menandai kuning kalau R:R-nya di bawah
1,5.

Keduanya butuh `GOOGLE_APPLICATION_CREDENTIALS` terisi, karena yang menyimpan
hasilnya adalah Admin SDK.

**Batas yang dipegang.** Yang keluar dari sini adalah hipotesis dengan angka
entry, stop, dan target, ditambah alasan yang bisa dibantah, bukan nasihat
investasi. "Tidak ada yang layak hari ini" adalah keluaran yang sah dan sering.
Hipotesis dengan rekomendasi beli atau jual ditolak sebelum tersimpan kalau
tidak punya stop, atau kalau rasio imbalan terhadap risikonya di bawah 1,5,
karena hipotesis tanpa stop tidak bisa dinilai belakangan. Nakhoda mencatat mana
yang kamu ambil dan mana yang kamu abaikan, lalu membandingkan win rate-nya
dengan keputusanmu sendiri di halaman Jurnal. Itu gunanya: supaya saran AI bisa
dinilai, bukan dituruti.

---

## Cara angkanya dihitung

**Biaya rata-rata, bukan FIFO.** Posisi fraksional kecil yang dicicil akan
melahirkan puluhan lot FIFO yang tidak berguna untuk keputusan apa pun. Fee
beli menaikkan basis, fee jual mengurangi hasil, jadi laba yang tampil sudah
bersih.

**Return bulanan pakai Modified Dietz**, bukan `(EMV-BMV)/BMV`:

```
R = (EMV − BMV − CF) / (BMV + Σ CF_i × (1 − t_i / T))
```

Setiap setoran diberi bobot sesuai berapa lama uang itu sempat bekerja. Setor
10 juta di tanggal 30 tidak akan terbaca sebagai "bulan ini luar biasa", karena
uang itu belum sempat menghasilkan apa pun.

**BMV butuh snapshot.** Nilai portofolio di awal bulan tidak bisa
direkonstruksi belakangan; harga pasar tanggal itu sudah lewat dan tidak
disimpan di mana pun. Nakhoda merekam satu foto nilai per hari saat app dibuka
dalam keadaan online dengan harga yang segar. Selama belum ada snapshot yang
cukup dekat, BMV diperkirakan dari nilai buku dan hasilnya ditandai
**perkiraan** di dasbor.

**Win rate dihitung dari trade yang ditutup di jurnal**, bukan dari nilai
portofolio, jadi setoran modal sama sekali tidak menyentuhnya.

**Biaya transaksi tidak ditebak.** Tarif fee ada di Pengaturan, terpisah untuk
saham dan kripto, dan nilai awalnya ditandai jelas sebagai perkiraan yang harus
diperiksa. Alasannya bukan kehati-hatian berlebihan: fee masuk ke basis biaya,
jadi tarif yang meleset 0,2% menggeser setiap angka laba di seluruh app,
pelan-pelan, tanpa pernah terlihat sebagai kesalahan. Pengaturan menyediakan
penghitung untuk menurunkan tarif sebenarnya dari satu transaksi nyata: masukkan
nilai kotor dan uang yang benar-benar berpindah, tarifnya jatuh sendiri.

Di formulir transaksi, fee terisi otomatis dari tarif itu dan berhenti terisi
otomatis begitu kamu mengetiknya sendiri.

**Menjual dibatasi kepemilikan nyata.** Formulir jual menyediakan tombol 25%,
50%, 75%, dan Jual semua yang mengambil angkanya langsung dari posisi, dengan
presisi penuh. Pecahan seperti 0,00493508 ETH mustahil diketik ulang tanpa
salah, dan sisa debu pecahan yang tak terjual adalah hasil paling umum dari
mengetiknya dari layar.

**Kalkulator ukuran posisi bekerja terbalik** dari kebiasaan umum: yang
ditentukan lebih dulu adalah berapa rupiah yang rela hilang, baru dari situ
lahir berapa unit yang boleh dibeli. Dengan begitu satu trade yang salah tidak
pernah bisa melukai lebih dalam dari jatah risikonya.

---

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm test` | Tes logika hitung (143 tes, tanpa framework) |
| `npm run lint` | ESLint |
| `npm run verify` | lint + test + build |
| `npm run kunci` | Simpan kunci API ke `.env.local` tanpa lewat riwayat shell |
| `npm run saran` | Tulis satu saran ke Firestore lewat Admin SDK |
| `npm run deploy-rules` | Terbitkan `firestore.rules` |
| `npx tsx scripts/buat-ikon.ts` | Bangun ulang ikon PNG dari `public/ikon.svg` |

---

## Deploy ke Vercel

Sudah jalan di **https://nakhoda.seawise.id**, proyek Vercel `seawise/nakhoda`,
tersambung ke repo ini. Push ke `main` langsung men-deploy produksi.

Kalau menyiapkan dari nol:

1. Push repo ke GitHub, lalu import di Vercel
2. Salin semua variabel dari `.env.local` ke **Settings → Environment Variables**,
   kecuali tiga ini: `GOOGLE_APPLICATION_CREDENTIALS` dan `NAKHODA_UID` hanya
   dipakai script di laptop, dan `NEXT_PUBLIC_JALUR_REPO` isinya jalur folder di
   laptop yang tidak ada artinya di server
3. Pastikan `npm run deploy-rules` sudah dijalankan. Ini satu-satunya yang
   benar-benar menjaga data; kunci `NEXT_PUBLIC_` memang ikut terkirim ke browser
4. Subdomain: tambahkan domainnya di Vercel, lalu di penyedia DNS pasang CNAME
   ke target yang diberikan Vercel. Untuk nakhoda.seawise.id di IDCloudHost:
   `CNAME nakhoda → d3653bddcb3b226e.vercel-dns-017.com.`

Dua hal yang sempat menggigit waktu menyiapkan ini:

- **Author commit harus punya akses ke tim Vercel.** Push dari identitas git
  yang bukan anggota tim tidak gagal build, tapi berstatus `BLOCKED` sebelum
  build dimulai, dan CLI versi lama cuma menampilkannya sebagai `UNKNOWN`.
- **Authorized domains di Firebase tidak perlu disentuh untuk login di sini.**
  Daftar itu mengunci handler OAuth dan tautan aksi email, sementara app ini
  masuk lewat `signInWithEmailAndPassword` yang tidak memeriksanya. Baru perlu
  diisi kalau nanti menambah login Google atau reset sandi lewat email.

Di HP, buka domainnya lalu "Add to Home Screen".

---

## Yang perlu disadari

| Risiko | Mitigasi |
|---|---|
| Service account key bocor | Simpan di luar repo, jangan pernah di-commit atau dikirim ke mana pun |
| Aturan keamanan salah konfigurasi | Sudah default-deny; uji dengan Firebase emulator sebelum deploy |
| Free tier Firebase kena limit | Pemakaian satu orang jauh di bawah 50K baca / 20K tulis per hari |
| Finnhub atau CoinGecko ubah kebijakan | Pengambil harga modular, ada di `src/app/api/harga` saja |
| TradingView adalah iframe pihak ketiga | Diterima sebagai trade-off; tidak ada data yang disimpan dari sana |
| Kurs historis tidak disimpan | Konversi lintas mata uang memakai kurs hari ini. Hanya berdampak pada ticker yang pernah dibeli dalam dua mata uang, dan posisi seperti itu ditandai "campur kurs" |

Ekspor JSON di halaman Pengaturan tetap dibuat meskipun data sudah di cloud.
Firebase melindungi dari kehilangan perangkat, bukan dari salah hapus.

---

## Struktur

```
src/
  app/            Halaman (App Router) dan dua route API: harga, kurs
  components/
    ui/           Kit dasar: kartu, tombol, isian, tabel, grafik
    shell/        Kerangka app: rel samping, bilah atas, bilah bawah, layar masuk
    formulir/     Form transaksi, modal, jurnal, kalkulator risiko
  lib/
    hitung/       Logika murni: posisi, kinerja, risiko, tinjauan, tonggak
    data/         Penyedia data, adaptor lokal dan Firestore, ekspor, data contoh
    __tests__/    Tes untuk seluruh isi hitung/
scripts/          tambah-saran, deploy-rules, buat-ikon, validasi-palet
firestore.rules   Aturan keamanan
```

Seluruh logika hitung di `src/lib/hitung/` adalah fungsi murni tanpa React dan
tanpa Firebase, dan seluruhnya punya tes. Di situlah setiap angka yang kamu
percaya di dasbor sebenarnya lahir.
