import type {
  HasilJurnal, JenisAset, JurnalEntri, MataUang, Transaksi,
} from "@/types";
import { konversi, type Kurs } from "./uang";
import { hariAntara, hariIni } from "@/lib/tanggal";
import { urutkanTransaksi } from "./posisi";

/* Trade sebagai siklus posisi.
 *
 * Posisi menjawab "sekarang punya apa". Modul ini menjawab pertanyaan lain:
 * "berapa kali saya masuk dan keluar, berapa yang benar-benar jadi uang, dan
 * berapa lama uang itu tertahan". Keduanya dibangun dari sumber yang sama,
 * yaitu riwayat transaksi, jadi tidak ada angka baru yang perlu diinput.
 *
 * Satu siklus dimulai saat kepemilikan naik dari nol dan berakhir saat
 * kepemilikan kembali ke nol. Beli tambahan dan jual sebagian di tengah jalan
 * tetap masuk ke siklus yang sama, karena secara ekonomi itu satu posisi yang
 * sama yang sedang dikelola, bukan dua trade terpisah.
 *
 * Kenapa bukan FIFO per lot: seluruh app memakai biaya rata-rata (lihat
 * posisi.ts), dan dua metode yang berbeda untuk satu portofolio akan
 * menghasilkan dua angka laba yang sama benarnya tapi tidak sama besarnya.
 * Itu jauh lebih membingungkan daripada nilainya.
 */

/** Ambang nol yang sama dengan posisi.ts. Sengaja disamakan: kalau debu 1e-9
 *  unit membuat posisi tetap terlihat terbuka di halaman Posisi, siklusnya
 *  juga harus terlihat belum selesai di sini. Dua halaman yang berbeda
 *  pendapat soal "sudah ditutup atau belum" lebih buruk daripada debu itu
 *  sendiri. */
const NOL = 1e-12;

export interface Trade {
  /** Stabil selama riwayat transaksinya tidak berubah, dipakai sebagai key. */
  id: string;
  ticker: string;
  jenisAset: JenisAset;
  /** Mata uang siklus, ditetapkan oleh transaksi yang membukanya. */
  mataUang: MataUang;
  tanggalMasuk: string;
  /** null selama siklusnya masih berjalan. */
  tanggalKeluar: string | null;
  /** Unit yang dibeli sepanjang siklus. */
  qty: number;
  /** Biaya per unit, sudah termasuk fee beli. */
  hargaMasukRata: number;
  /** Hasil per unit setelah fee jual. null kalau belum ada penjualan. */
  hargaKeluarRata: number | null;
  /** Biaya perolehan yang dikeluarkan di siklus ini. */
  modal: number;
  /** Laba bersih dalam `mataUang`. null kalau basis biayanya tidak lengkap,
   *  karena angka apa pun di situ akan menyesatkan. */
  hasil: number | null;
  hasilPersen: number | null;
  /** Sampai tanggal keluar, atau sampai hari ini kalau masih berjalan. */
  hariHold: number;
  fee: number;
  idTransaksi: string[];
  selesai: boolean;
  /** Benar kalau ada unit yang dijual tanpa pernah tercatat pembeliannya.
   *  Hasilnya tidak bisa dihitung: yang keluar diketahui, yang masuk tidak.
   *  Ini bukan kasus teoretis, penjualan GE 8 Jun 2026 persis seperti ini. */
  basisTidakLengkap: boolean;
}

interface Siklus {
  ticker: string;
  jenisAset: JenisAset;
  mataUang: MataUang;
  tanggalMasuk: string;
  tanggalKeluar: string | null;
  qtyMasuk: number;
  biayaMasuk: number;
  qtyKeluar: number;
  hasilKeluar: number;
  laba: number;
  fee: number;
  idTransaksi: string[];
  basisTidakLengkap: boolean;
}

interface Keadaan {
  qty: number;
  biaya: number;
  siklus: Siklus | null;
}

function bekukan(s: Siklus, selesai: boolean, kini: string): Trade {
  const modal = s.biayaMasuk;
  const hasil = s.basisTidakLengkap ? null : s.laba;
  return {
    id: `${s.ticker}-${s.tanggalMasuk}-${s.idTransaksi[0] ?? "0"}`,
    ticker: s.ticker,
    jenisAset: s.jenisAset,
    mataUang: s.mataUang,
    tanggalMasuk: s.tanggalMasuk,
    tanggalKeluar: s.tanggalKeluar,
    qty: s.qtyMasuk,
    hargaMasukRata: s.qtyMasuk > 0 ? s.biayaMasuk / s.qtyMasuk : 0,
    hargaKeluarRata: s.qtyKeluar > 0 ? s.hasilKeluar / s.qtyKeluar : null,
    modal,
    hasil,
    hasilPersen: hasil !== null && modal > 0 ? (hasil / modal) * 100 : null,
    hariHold: hariAntara(s.tanggalMasuk, s.tanggalKeluar ?? kini),
    fee: s.fee,
    idTransaksi: s.idTransaksi,
    selesai,
    basisTidakLengkap: s.basisTidakLengkap,
  };
}

/** Membangun daftar trade dari riwayat transaksi.
 *
 *  Siklus yang masih berjalan ikut dikembalikan dengan `selesai: false`, supaya
 *  UI bisa menampilkan sudah berapa lama posisi berjalan tanpa perlu menghitung
 *  ulang sendiri. */
export function bangunTrade(
  daftar: readonly Transaksi[],
  kurs: Kurs,
  kini: string = hariIni(),
): Trade[] {
  const keadaan = new Map<string, Keadaan>();
  const hasil: Trade[] = [];

  for (const t of urutkanTransaksi(daftar)) {
    const ticker = t.ticker.trim().toUpperCase();
    if (!ticker || !Number.isFinite(t.qty) || !Number.isFinite(t.harga)) continue;

    const k = keadaan.get(ticker) ?? { qty: 0, biaya: 0, siklus: null };
    keadaan.set(ticker, k);

    if (!k.siklus) {
      k.siklus = {
        ticker,
        jenisAset: t.jenisAset,
        mataUang: t.mataUang,
        tanggalMasuk: t.tanggal,
        tanggalKeluar: null,
        qtyMasuk: 0,
        biayaMasuk: 0,
        qtyKeluar: 0,
        hasilKeluar: 0,
        laba: 0,
        fee: 0,
        idTransaksi: [],
        basisTidakLengkap: false,
      };
    }
    const s = k.siklus;

    const harga = konversi(t.harga, t.mataUang, s.mataUang, kurs);
    const fee = konversi(t.fee || 0, t.mataUang, s.mataUang, kurs);
    const qty = Math.abs(t.qty);

    s.fee += fee;
    s.idTransaksi.push(t.id);
    s.jenisAset = t.jenisAset;

    if (t.sisi === "beli") {
      k.qty += qty;
      k.biaya += qty * harga + fee;
      s.qtyMasuk += qty;
      s.biayaMasuk += qty * harga + fee;
      continue;
    }

    // Jual lebih banyak dari yang tercatat dipegang. posisi.ts memperlakukan
    // sisanya sebagai basis nol supaya dasbor tidak rusak; di sini justru
    // sebaliknya, siklusnya ditandai tidak lengkap dan hasilnya dibuang.
    // Alasannya beda peran: dasbor harus tetap menampilkan sesuatu, sedangkan
    // statistik trade yang memuat satu kemenangan palsu 100% akan merusak win
    // rate dan ekspektansi tanpa terlihat rusak.
    if (qty > k.qty + NOL) s.basisTidakLengkap = true;

    const terjual = Math.min(qty, k.qty);
    const avg = k.qty > 0 ? k.biaya / k.qty : 0;

    s.laba += qty * harga - fee - terjual * avg;
    s.qtyKeluar += qty;
    s.hasilKeluar += qty * harga - fee;
    s.tanggalKeluar = t.tanggal;

    k.biaya -= terjual * avg;
    k.qty -= terjual;

    if (k.qty <= NOL) {
      k.qty = 0;
      k.biaya = 0;
      hasil.push(bekukan(s, true, kini));
      k.siklus = null;
    }
  }

  for (const k of keadaan.values()) {
    if (k.siklus) hasil.push(bekukan(k.siklus, false, kini));
  }

  return hasil.sort(
    (a, b) =>
      (b.tanggalKeluar ?? "9999").localeCompare(a.tanggalKeluar ?? "9999") ||
      b.tanggalMasuk.localeCompare(a.tanggalMasuk) ||
      a.ticker.localeCompare(b.ticker),
  );
}

export interface StatistikTrade {
  /** Trade selesai yang basis biayanya lengkap. Ini penyebut win rate. */
  total: number;
  menang: number;
  kalah: number;
  impas: number;
  /** Persen. null kalau belum ada trade yang selesai. */
  winRate: number | null;
  /** Semua nilai uang di bawah ini dalam mata uang dasar. */
  totalHasil: number;
  rataMenang: number | null;
  rataKalah: number | null;
  /** Total untung dibagi total rugi. Di atas 1 berarti yang menang lebih besar
   *  daripada yang kalah, bahkan kalau jumlah trade kalahnya lebih banyak. */
  faktorUntung: number | null;
  /** Hari, dari beli pertama sampai jual yang menutup posisi. */
  rataHariHold: number | null;
  rataHariMenang: number | null;
  rataHariKalah: number | null;
  hariHoldTerlama: number | null;
  terbuka: number;
  /** Dikeluarkan dari statistik karena pembeliannya tidak pernah tercatat. */
  tidakLengkap: number;
}

const rata = (xs: readonly number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Statistik dari uang sungguhan yang sudah masuk dan keluar.
 *
 *  Bedanya dengan statistikJurnal di kinerja.ts: yang ini tidak butuh entri
 *  jurnal sama sekali, jadi trade lama yang tidak pernah ditulis thesisnya
 *  tetap terhitung. Yang tidak bisa dijawab di sini adalah R-multiple, karena
 *  stop loss yang direncanakan tidak ada di transaksi, cuma ada di jurnal. */
export function statistikTrade(
  daftar: readonly Trade[],
  dasar: MataUang,
  kurs: Kurs,
): StatistikTrade {
  const selesai = daftar.filter((t) => t.selesai && !t.basisTidakLengkap && t.hasil !== null);

  const uang = selesai.map((t) => ({
    hasil: konversi(t.hasil as number, t.mataUang, dasar, kurs),
    hari: t.hariHold,
  }));

  const menang = uang.filter((u) => u.hasil > 0);
  const kalah = uang.filter((u) => u.hasil < 0);
  const impas = uang.filter((u) => u.hasil === 0);
  const totalRugi = kalah.reduce((s, u) => s + Math.abs(u.hasil), 0);
  const totalUntung = menang.reduce((s, u) => s + u.hasil, 0);

  return {
    total: uang.length,
    menang: menang.length,
    kalah: kalah.length,
    impas: impas.length,
    winRate: uang.length ? (menang.length / uang.length) * 100 : null,
    totalHasil: uang.reduce((s, u) => s + u.hasil, 0),
    rataMenang: rata(menang.map((u) => u.hasil)),
    rataKalah: rata(kalah.map((u) => u.hasil)),
    // Tanpa trade rugi sama sekali, faktor untung tidak terdefinisi, bukan tak
    // hingga. Menampilkan "∞" dari tiga trade menang beruntun cuma menipu diri.
    faktorUntung: totalRugi > 0 ? totalUntung / totalRugi : null,
    rataHariHold: rata(uang.map((u) => u.hari)),
    rataHariMenang: rata(menang.map((u) => u.hari)),
    rataHariKalah: rata(kalah.map((u) => u.hari)),
    hariHoldTerlama: uang.length ? Math.max(...uang.map((u) => u.hari)) : null,
    terbuka: daftar.filter((t) => !t.selesai).length,
    tidakLengkap: daftar.filter((t) => t.selesai && t.basisTidakLengkap).length,
  };
}

export interface UsulanTutup {
  entri: JurnalEntri;
  trade: Trade;
  /** Sudah dikonversi ke mata uang entri jurnalnya. */
  hargaKeluar: number;
  tanggalKeluar: string;
  hasil: HasilJurnal;
}

/** Mencari entri jurnal yang masih terbuka padahal posisinya sudah ditutup.
 *
 *  Sengaja hanya mengusulkan, tidak menulis. Satu ticker bisa punya dua entri
 *  jurnal, dan jual sebagian tidak selalu berarti thesisnya sudah selesai.
 *  Menutup entri diam-diam berarti menebak niat, dan catatan pelajaran yang
 *  paling berharga justru ditulis pada saat menutupnya. */
export function usulkanPenutupan(
  jurnal: readonly JurnalEntri[],
  trade: readonly Trade[],
  kurs: Kurs,
): UsulanTutup[] {
  const usulan: UsulanTutup[] = [];

  for (const entri of jurnal) {
    if (entri.status !== "terbuka") continue;

    // Trade selesai paling awal yang keluarnya tidak mendahului thesisnya.
    // Kalau entrinya ditulis setelah posisi ditutup, itu bukan trade ini.
    const cocok = trade
      .filter(
        (t) =>
          t.selesai &&
          !t.basisTidakLengkap &&
          t.hargaKeluarRata !== null &&
          t.ticker === entri.ticker.trim().toUpperCase() &&
          (t.tanggalKeluar ?? "") >= entri.tanggal,
      )
      .sort((a, b) => (a.tanggalKeluar ?? "").localeCompare(b.tanggalKeluar ?? ""))[0];

    if (!cocok) continue;

    usulan.push({
      entri,
      trade: cocok,
      hargaKeluar: konversi(
        cocok.hargaKeluarRata as number,
        cocok.mataUang,
        entri.mataUang,
        kurs,
      ),
      tanggalKeluar: cocok.tanggalKeluar as string,
      // Untung atau rugi ditentukan uang yang benar-benar masuk, bukan
      // perbandingan harga entry dan harga keluar. Fee dua arah bisa membuat
      // trade yang harganya naik tipis tetap rugi bersih.
      hasil:
        (cocok.hasil as number) > 0 ? "untung" : (cocok.hasil as number) < 0 ? "rugi" : "impas",
    });
  }

  return usulan;
}
