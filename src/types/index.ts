/* Tipe data Nakhoda.
 *
 * Konvensi tanggal: semua tanggal transaksi/jurnal/arus modal disimpan
 * sebagai string `YYYY-MM-DD` waktu lokal, bukan Timestamp Firestore.
 * Alasannya, semua perhitungan di app ini beroperasi pada tanggal kalender
 * (return bulanan, bobot Modified Dietz), bukan pada momen presisi detik.
 * String tanggal menghilangkan seluruh kelas bug zona waktu di situ.
 *
 * Stempel waktu mesin (kapan harga terakhir diambil, kapan dokumen dibuat)
 * tetap disimpan sebagai epoch milidetik.
 */

export type JenisAset = "saham" | "kripto";
export type Sisi = "beli" | "jual";
export type MataUang = "IDR" | "USD";

/** Satu baris transaksi. Sumber kebenaran tunggal; posisi diturunkan dari sini. */
export interface Transaksi {
  id: string;
  uid: string;
  ticker: string;
  jenisAset: JenisAset;
  sisi: Sisi;
  tanggal: string;
  /** Jumlah unit. Boleh pecahan, Pluang menjual saham fraksional. */
  qty: number;
  /** Harga per unit, dinyatakan dalam `mataUang`. */
  harga: number;
  /** Biaya broker untuk transaksi ini, dalam `mataUang`. */
  fee: number;
  mataUang: MataUang;
  catatan?: string;
  dibuatPada: number;
}

export type TipeArus = "awal" | "setor" | "tarik";

/** Uang masuk atau keluar dari portofolio, bukan hasil trading.
 *  Dipisahkan supaya return bulanan tidak terdistorsi setoran modal baru. */
export interface ArusModal {
  id: string;
  uid: string;
  tanggal: string;
  /** Selalu positif. Arah ditentukan oleh `tipe`, bukan oleh tanda. */
  jumlah: number;
  mataUang: MataUang;
  tipe: TipeArus;
  catatan?: string;
  dibuatPada: number;
}

export type StatusJurnal = "terbuka" | "tertutup" | "batal";
export type HasilJurnal = "untung" | "rugi" | "impas";

export interface JurnalEntri {
  id: string;
  uid: string;
  ticker: string;
  jenisAset: JenisAset;
  tanggal: string;
  mataUang: MataUang;
  thesisTeknikal: string;
  thesisFundamental: string;
  hargaEntry: number;
  stopLoss: number;
  targetHarga: number;
  qty?: number;
  status: StatusJurnal;
  hasil?: HasilJurnal;
  /** Harga keluar sebenarnya, diisi saat posisi ditutup. */
  hargaKeluar?: number;
  tanggalKeluar?: string;
  pelajaran?: string;
  /** Kalau entri ini lahir dari sebuah saran AI. */
  idSaran?: string;
  /** Transaksi beli yang mengisi entri ini, kalau entrinya diambil dari
   *  riwayat transaksi dan bukan diketik ulang. Disimpan supaya harga entry di
   *  jurnal bisa ditelusuri balik ke struk brokernya. */
  idTransaksiMasuk?: string;
  /** Transaksi jual yang menutup entri ini. */
  idTransaksiKeluar?: string;
  dibuatPada: number;
}

export type Rekomendasi = "beli" | "tahan" | "jual" | "pantau";
export type StatusSaran = "menunggu" | "diambil" | "diabaikan";

/** Ditulis oleh script Claude Code lewat Admin SDK, dibaca oleh app. */
export interface Saran {
  id: string;
  uid: string;
  ticker: string;
  jenisAset: JenisAset;
  tanggal: string;
  sumber: string;
  rekomendasi: Rekomendasi;
  catatanTeknikal: string;
  catatanFundamental: string;
  entrySaran?: number;
  stopSaran?: number;
  targetSaran?: number;
  mataUang: MataUang;
  status: StatusSaran;
  idJurnal?: string;
  dibuatPada: number;
}

export interface HargaCache {
  /** Sama dengan `ticker`. Ada supaya semua dokumen punya bentuk yang sama
   *  di lapisan penyimpanan, apa pun koleksinya. */
  id: string;
  /** Ticker huruf besar, mis. "NVDA" atau "BTC". */
  ticker: string;
  uid: string;
  jenisAset: JenisAset;
  harga: number;
  mataUang: MataUang;
  diperbaruiPada: number;
  sumber: string;
}

export interface KursCache {
  /** Sama dengan `pasangan`. */
  id: string;
  /** Mis. "USD_IDR". */
  pasangan: string;
  uid: string;
  kurs: number;
  diperbaruiPada: number;
  sumber: string;
}

export interface Pengaturan {
  uid: string;
  /** Target return bulanan pribadi, dalam persen. Tujuan Agus, bukan proyeksi. */
  targetBulananMin: number;
  targetBulananMax: number;
  mataUangDasar: MataUang;
  /** Target kekayaan jangka panjang, dalam mata uang dasar. */
  targetKekayaan: number;
  /** Kurs cadangan kalau API kurs tidak bisa dihubungi sama sekali. */
  kursManualUsdIdr: number;
  /** Biaya broker per transaksi, dalam persen dari nilai transaksi.
   *  Dipisah per kelas aset karena Pluang memungut berbeda untuk keduanya:
   *  saham AS lewat fee eksplisit, kripto lewat selisih harga beli-jual. */
  feePersenSaham: number;
  feePersenKripto: number;
}

/** Posisi tidak disimpan di database. Selalu diturunkan dari transaksi. */
export interface Posisi {
  ticker: string;
  jenisAset: JenisAset;
  mataUang: MataUang;
  qty: number;
  /** Harga rata-rata per unit, sudah termasuk fee pembelian. */
  avgHarga: number;
  /** qty × avgHarga. Modal yang masih menempel di posisi ini. */
  biayaTotal: number;
  labaTerealisasi: number;
  feeTotal: number;
  jumlahTransaksi: number;
  tanggalPertama: string;
  tanggalTerakhir: string;
  /** Benar kalau ticker ini pernah ditransaksikan dalam dua mata uang berbeda.
   *  Nilainya jadi hasil konversi kurs terkini, bukan kurs historis. */
  campurMataUang: boolean;
  hargaTerakhir?: number;
  hargaDiperbaruiPada?: number;
  nilaiPasar?: number;
  labaBelumTerealisasi?: number;
  labaBelumTerealisasiPersen?: number;
}

export type ModeData = "lokal" | "firestore";

/** Foto nilai portofolio pada satu tanggal.
 *
 *  Ada karena Modified Dietz butuh nilai pasar di awal periode (BMV), dan
 *  nilai itu tidak bisa direkonstruksi belakangan: harga pasar 1 September
 *  sudah lewat dan tidak disimpan di mana pun. Nakhoda merekam satu snapshot
 *  per hari saat app dibuka dalam keadaan online dengan harga segar. */
export interface Snapshot {
  id: string;
  uid: string;
  tanggal: string;
  nilaiTotal: number;
  mataUang: MataUang;
  dibuatPada: number;
}

export type StatusRiset = "menunggu" | "diproses" | "selesai" | "gagal";

/** Ringkasan keadaan portofolio yang ikut dikirim bersama permintaan riset.
 *
 *  Disalin ke dalam dokumen permintaan, bukan dibaca ulang oleh watcher, karena
 *  yang harus dianalisis adalah keadaan saat tombol ditekan. Kalau harga
 *  bergerak antara permintaan dibuat dan diproses, hasil risetnya tetap
 *  menjawab pertanyaan yang benar-benar diajukan. */
export interface KonteksRiset {
  mataUangDasar: MataUang;
  totalNilai: number;
  kas: number;
  targetBulananMin: number;
  targetBulananMax: number;
  returnBulanBerjalan: number | null;
  /** Rupiah yang direlakan hilang per satu trade. */
  jatahRisiko: number;
  posisi: {
    ticker: string;
    jenisAset: JenisAset;
    qty: number;
    avgHarga: number;
    hargaTerakhir?: number;
    mataUang: MataUang;
    labaPersen?: number;
    /** Stop dan target dari jurnal terbuka, kalau ada. */
    stopLoss?: number;
    targetHarga?: number;
  }[];
  /** Ticker yang pernah muncul di saran tapi belum dipegang. */
  pengawasan: string[];
}

/** Permintaan riset yang ditulis app dan dikerjakan watcher di laptop.
 *
 *  Halaman web tidak bisa memerintah Claude Code secara langsung, jadi arahnya
 *  dibalik: app menaruh permintaan di Firestore, dan script di laptop yang
 *  mengambilnya. Konsekuensinya, permintaan cuma dikerjakan saat watcher-nya
 *  hidup, dan status di bawah yang memberitahu itu ke pengguna. */
export interface PermintaanRiset {
  id: string;
  uid: string;
  tanggal: string;
  status: StatusRiset;
  konteks: KonteksRiset;
  dibuatPada: number;
  diprosesPada?: number;
  selesaiPada?: number;
  jumlahSaran?: number;
  pesanGagal?: string;
}
