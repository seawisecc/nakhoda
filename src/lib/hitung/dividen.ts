import type { Dividen, MataUang, Posisi } from "@/types";
import { konversi, type Kurs } from "./uang";
import { tambahHari } from "@/lib/tanggal";

/** Uang yang benar-benar mendarat di kas: kotor dikurangi pajak di sumber.
 *
 *  Dipakai di mana-mana lewat fungsi ini, tidak pernah ditulis ulang sebagai
 *  `d.jumlahKotor - d.pajak` di tempat lain. Satu salinan rumus yang sama di
 *  dua modul adalah cara paling rapi menghasilkan dua angka kas yang berbeda
 *  dari data yang sama. */
export function bersihDividen(d: Pick<Dividen, "jumlahKotor" | "pajak">): number {
  const kotor = Number.isFinite(d.jumlahKotor) ? d.jumlahKotor : 0;
  const pajak = Number.isFinite(d.pajak) ? d.pajak : 0;
  return kotor - pajak;
}

/** Dividen bersih yang sudah diterima sampai satu tanggal, dalam mata uang
 *  dasar. `sampai` null berarti seluruh riwayat.
 *
 *  Angka ini masuk ke kas, jadi dia ikut menaikkan nilai portofolio tanpa
 *  menaikkan modal bersih. Itulah sebabnya dividen tampil sebagai laba di
 *  `labaTotal` tanpa perlu dijumlahkan sendiri di sana. */
export function dividenSampai(
  daftar: readonly Dividen[],
  sampai: string | null,
  dasar: MataUang,
  kurs: Kurs,
): number {
  let jumlah = 0;
  for (const d of daftar) {
    if (sampai && d.tanggal > sampai) continue;
    jumlah += konversi(bersihDividen(d), d.mataUang, dasar, kurs);
  }
  return jumlah;
}

/** Dividen bersih yang diterima di dalam satu jendela tanggal, inklusif di
 *  kedua ujungnya. Batasnya sengaja sama dengan `realisasiPeriode()` supaya
 *  dua angka yang ditampilkan bersebelahan mengukur periode yang sama. */
export function dividenPeriode(
  daftar: readonly Dividen[],
  mulai: string,
  akhir: string,
  dasar: MataUang,
  kurs: Kurs,
): { jumlah: number; banyak: number } {
  const dalam = daftar.filter((d) => d.tanggal >= mulai && d.tanggal <= akhir);
  return {
    jumlah: dalam.reduce((s, d) => s + konversi(bersihDividen(d), d.mataUang, dasar, kurs), 0),
    banyak: dalam.length,
  };
}

export interface DividenTicker {
  ticker: string;
  jenisAset: Dividen["jenisAset"];
  /** Total bersih sepanjang riwayat, dalam mata uang dasar. */
  bersih: number;
  kotor: number;
  pajak: number;
  /** Bersih dalam 12 bulan terakhir. Ini yang dipakai untuk hasil atas biaya,
   *  karena dividen dua tahun lalu tidak mengatakan apa pun tentang aliran kas
   *  yang sedang berjalan. */
  bersih12Bulan: number;
  banyak: number;
  terakhir: string;
}

/** Rekap dividen per ticker, urut dari yang terbesar.
 *
 *  `sampai` adalah tanggal acuan untuk jendela 12 bulan, bukan penyaring:
 *  dividen yang tanggalnya di depan acuan tetap ikut ke total, karena itu uang
 *  yang sudah tercatat diterima dan menghilangkannya dari total akan membuat
 *  rekap ini tidak cocok dengan kas. */
export function dividenPerTicker(
  daftar: readonly Dividen[],
  dasar: MataUang,
  kurs: Kurs,
  sampai: string,
): DividenTicker[] {
  const peta = new Map<string, DividenTicker>();
  const batas12 = tambahHari(sampai, -365);

  for (const d of daftar) {
    const k = d.ticker.trim().toUpperCase();
    if (!k) continue;
    let r = peta.get(k);
    if (!r) {
      r = {
        ticker: k, jenisAset: d.jenisAset, bersih: 0, kotor: 0, pajak: 0,
        bersih12Bulan: 0, banyak: 0, terakhir: d.tanggal,
      };
      peta.set(k, r);
    }
    const bersih = konversi(bersihDividen(d), d.mataUang, dasar, kurs);
    r.bersih += bersih;
    r.kotor += konversi(d.jumlahKotor || 0, d.mataUang, dasar, kurs);
    r.pajak += konversi(d.pajak || 0, d.mataUang, dasar, kurs);
    if (d.tanggal > batas12 && d.tanggal <= sampai) r.bersih12Bulan += bersih;
    r.banyak += 1;
    if (d.tanggal > r.terakhir) r.terakhir = d.tanggal;
    r.jenisAset = d.jenisAset;
  }

  return [...peta.values()].sort((a, b) => b.bersih - a.bersih || a.ticker.localeCompare(b.ticker));
}

export interface HasilAtasBiaya {
  ticker: string;
  /** Dividen bersih 12 bulan terakhir, dalam mata uang dasar. */
  bersih12Bulan: number;
  /** Modal yang masih menempel di posisi, dalam mata uang dasar. */
  biaya: number;
  /** bersih12Bulan / biaya, dalam persen. */
  persen: number;
}

/** Hasil dividen atas biaya perolehan, untuk posisi yang masih dipegang.
 *
 *  Bukan dividend yield pasar. Penyebutnya biaya perolehan sendiri, jadi
 *  angkanya menjawab "uang saya menghasilkan berapa persen setahun", bukan
 *  "kalau beli hari ini dapat berapa".
 *
 *  Dikembalikan hanya untuk posisi yang benar-benar punya dividen tercatat dan
 *  biaya di atas nol. Posisi yang dividennya tidak pernah dicatat akan hilang
 *  dari daftar ini, bukan muncul dengan 0%: nol persen adalah klaim bahwa
 *  emitennya tidak membayar, dan itu bukan yang diketahui datanya. */
export function hasilAtasBiaya(
  posisi: readonly Posisi[],
  dividen: readonly Dividen[],
  dasar: MataUang,
  kurs: Kurs,
  sampai: string,
): HasilAtasBiaya[] {
  const rekap = new Map(dividenPerTicker(dividen, dasar, kurs, sampai).map((r) => [r.ticker, r]));

  const hasil: HasilAtasBiaya[] = [];
  for (const p of posisi) {
    if (p.qty <= 0) continue;
    const r = rekap.get(p.ticker);
    if (!r || r.bersih12Bulan <= 0) continue;
    const biaya = konversi(p.biayaTotal, p.mataUang, dasar, kurs);
    if (!(biaya > 0)) continue;
    hasil.push({
      ticker: p.ticker,
      bersih12Bulan: r.bersih12Bulan,
      biaya,
      persen: (r.bersih12Bulan / biaya) * 100,
    });
  }

  return hasil.sort((a, b) => b.persen - a.persen);
}

/** Ticker yang pernah membayar dividen tapi belum ada catatannya dalam
 *  `jedaHari` terakhir, padahal posisinya masih dipegang.
 *
 *  Dividen masuk lewat ketikan tangan, jadi yang paling mungkin terjadi bukan
 *  salah angka melainkan lupa mencatat sama sekali. Yang lupa dicatat tidak
 *  meninggalkan jejak apa pun di layar, dan diam itu yang perlu dipecah. */
export function dividenTerlewat(
  posisi: readonly Posisi[],
  dividen: readonly Dividen[],
  sampai: string,
  jedaHari = 120,
): { ticker: string; terakhir: string; selangHari: number }[] {
  const terakhir = new Map<string, string>();
  for (const d of dividen) {
    const k = d.ticker.trim().toUpperCase();
    const ada = terakhir.get(k);
    if (!ada || d.tanggal > ada) terakhir.set(k, d.tanggal);
  }

  const hasil: { ticker: string; terakhir: string; selangHari: number }[] = [];
  for (const p of posisi) {
    if (p.qty <= 0) continue;
    const t = terakhir.get(p.ticker);
    if (!t) continue;
    const selang = Math.round(
      (Date.parse(`${sampai}T12:00:00Z`) - Date.parse(`${t}T12:00:00Z`)) / 86_400_000,
    );
    if (selang > jedaHari) hasil.push({ ticker: p.ticker, terakhir: t, selangHari: selang });
  }

  return hasil.sort((a, b) => b.selangHari - a.selangHari);
}
