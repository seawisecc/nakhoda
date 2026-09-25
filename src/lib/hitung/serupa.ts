import type { Lilin } from "./sinyal";

/* Pola serupa: potongan riwayat yang bentuknya paling mirip dengan beberapa
 * sesi terakhir, di ticker yang sama.
 *
 * Yang dicocokkan BENTUK, bukan harga: tiap potongan dinormalkan (log tutup,
 * dikurangi rata-ratanya, dibagi simpangannya) lalu dibandingkan lewat
 * korelasi. Tanpa normalisasi, saham yang naik sepuluh kali lipat dalam satu
 * dekade cuma akan "mirip" dengan minggu-minggu di sekitar harga yang sama.
 *
 * Pencocokan tidak pernah melihat apa yang terjadi SESUDAH potongannya. Hasil
 * sesudahnya baru dinilai belakangan, lewat uji-kejadian, terhadap hari
 * biasa. Kalau pemilihan ikut melihat hasil, ujinya menilai pilihan kita
 * sendiri, bukan bentuknya.
 */

/** Panjang potongan yang dicocokkan dan jumlah kecocokan maksimal. Sengaja
 *  tetap, bukan pilihan di layar: setiap tombol yang mengubahnya adalah satu
 *  uji tambahan, dan mengutak-atiknya sampai hasilnya bagus adalah cara
 *  paling mudah menemukan pola yang tidak ada. */
export const PANJANG_SERUPA = 20;
export const JUMLAH_SERUPA = 15;
/** Di bawah korelasi ini, dua potongan cuma sama-sama naik atau sama-sama
 *  turun. "Kecocokan terbaik" yang korelasinya 0,5 bukan kecocokan. */
export const KORELASI_MIN = 0.8;

export interface Kecocokan {
  /** Indeks lilin terakhir potongan yang cocok. */
  akhir: number;
  korelasi: number;
}

export interface HasilSerupa {
  /** Indeks awal dan akhir potongan acuan, yaitu sesi-sesi terakhir. */
  acuanDari: number;
  acuanSampai: number;
  /** Diurut dari yang paling mirip. */
  cocok: Kecocokan[];
}

/** Potongan yang dinormalkan, atau null kalau datar (simpangan nol): bentuk
 *  datar tidak punya korelasi dengan apa pun. */
function normal(tutup: number[], dari: number, panjang: number): number[] | null {
  const x: number[] = [];
  for (let i = dari; i < dari + panjang; i += 1) {
    if (!(tutup[i] > 0)) return null;
    x.push(Math.log(tutup[i]));
  }
  const rata = x.reduce((s, v) => s + v, 0) / panjang;
  const sd = Math.sqrt(x.reduce((s, v) => s + (v - rata) ** 2, 0) / panjang);
  // Ambang, bukan nol: log dari harga yang sama persis tetap menyisakan
  // simpangan 1e-16 dari pembulatan, dan membaginya menghasilkan bentuk
  // acak dari derau.
  if (!(sd > 1e-9)) return null;
  return x.map((v) => (v - rata) / sd);
}

export function cariSerupa(
  b: Lilin[],
  opsi: { panjang?: number; jumlah?: number; korelasiMin?: number } = {},
): HasilSerupa | null {
  const panjang = opsi.panjang ?? PANJANG_SERUPA;
  const jumlah = opsi.jumlah ?? JUMLAH_SERUPA;
  const korelasiMin = opsi.korelasiMin ?? KORELASI_MIN;
  const n = b.length;
  if (n < panjang * 3) return null;

  const tutup = b.map((x) => x.tutup);
  const acuanDari = n - panjang;
  const acuan = normal(tutup, acuanDari, panjang);
  if (!acuan) return null;

  // Kandidat berakhir paling lambat tepat sebelum potongan acuan dimulai.
  // Potongan yang tumpang tindih dengan acuan akan mirip dengan dirinya
  // sendiri, dan hasil sesudahnya adalah harga hari ini.
  const kandidat: Kecocokan[] = [];
  for (let akhir = panjang - 1; akhir < acuanDari; akhir += 1) {
    const z = normal(tutup, akhir - panjang + 1, panjang);
    if (!z) continue;
    let r = 0;
    for (let k = 0; k < panjang; k += 1) r += z[k] * acuan[k];
    r /= panjang;
    if (r >= korelasiMin) kandidat.push({ akhir, korelasi: r });
  }
  kandidat.sort((p, q) => q.korelasi - p.korelasi);

  // Rakus dari yang paling mirip, menolak yang tumpang tindih dengan yang
  // sudah diambil. Tanpa itu, lima belas kecocokan teratas hampir selalu
  // satu momen yang sama digeser satu hari, dan uji menghitungnya sebagai
  // lima belas bukti.
  const cocok: Kecocokan[] = [];
  for (const k of kandidat) {
    if (cocok.length >= jumlah) break;
    if (cocok.every((c) => Math.abs(c.akhir - k.akhir) >= panjang)) cocok.push(k);
  }
  return { acuanDari, acuanSampai: n - 1, cocok };
}
