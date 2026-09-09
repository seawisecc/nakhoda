/* Level harga untuk bantu baca chart.
 *
 * Semuanya aritmatika atas OHLC sesi terakhir. Tidak ada yang meramal: pivot
 * dan Fibonacci cuma cara konvensional membagi rentang harga jadi angka yang
 * banyak orang perhatikan. Kegunaannya justru karena banyak yang memakainya,
 * bukan karena ada yang benar secara alamiah.
 */

import type { MataUang } from "@/types";
import { konversi, type Kurs } from "./uang";

export interface Ohlc {
  buka: number;
  tinggi: number;
  rendah: number;
  tutup: number;
  /** Penutupan sesi sebelumnya. */
  tutupSebelumnya?: number;
}

export interface Level {
  nama: string;
  harga: number;
  kelompok: "pivot" | "fibonacci" | "milikmu";
  /** Jarak dari harga sekarang, dalam persen. Positif berarti di atas. */
  jarakPersen: number;
}

const bulat = (n: number) => Number(n.toFixed(8));

/** Pivot point klasik (floor trader).
 *
 *  P adalah rata-rata tinggi, rendah, dan tutup. Level di atasnya resistance,
 *  di bawahnya support. Rumusnya sudah dipakai sejak lantai bursa dan tidak
 *  pernah berubah, jadi tidak ada varian yang perlu dipilih di sini. */
export function pivotKlasik(o: Ohlc): { nama: string; harga: number }[] {
  const { tinggi: h, rendah: l, tutup: c } = o;
  if (![h, l, c].every((n) => Number.isFinite(n) && n > 0) || h < l) return [];
  const p = (h + l + c) / 3;
  const rentang = h - l;
  return [
    { nama: "R3", harga: bulat(h + 2 * (p - l)) },
    { nama: "R2", harga: bulat(p + rentang) },
    { nama: "R1", harga: bulat(2 * p - l) },
    { nama: "Pivot", harga: bulat(p) },
    { nama: "S1", harga: bulat(2 * p - h) },
    { nama: "S2", harga: bulat(p - rentang) },
    { nama: "S3", harga: bulat(l - 2 * (h - p)) },
  ];
}

const RASIO_FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Retracement Fibonacci antara rendah dan tinggi sesi.
 *
 *  Arahnya mengikuti arah sesi: kalau tutup di atas buka, 0% ditaruh di rendah
 *  supaya level dibaca sebagai tempat harga mungkin kembali turun; kalau sesi
 *  turun, dibalik. Menaruhnya selalu dari satu sisi akan membuat separuh
 *  levelnya tidak bermakna. */
export function fibonacci(o: Ohlc): { nama: string; harga: number }[] {
  const { tinggi: h, rendah: l } = o;
  if (![h, l].every((n) => Number.isFinite(n) && n > 0) || h <= l) return [];
  const naik = o.tutup >= o.buka;
  return RASIO_FIB.map((r) => ({
    nama: `Fib ${(r * 100).toFixed(1).replace(/\.0$/, "")}%`,
    harga: bulat(naik ? h - (h - l) * r : l + (h - l) * r),
  }));
}

/** Mengubah OHLC yang selalu datang dalam USD ke mata uang posisi.
 *
 *  Ada sebagai fungsi tersendiri karena inilah tempat bug paling mahal
 *  bersembunyi: level milikmu ada dalam mata uang posisi, sedangkan sumber
 *  data OHLC selalu dolar. Tanpa konversi, harga dolar tampil dengan label
 *  rupiah dan meleset belasan ribu kali, lalu bercampur dengan level milikmu
 *  yang satuannya benar sehingga seluruh daftar jadi omong kosong yang
 *  kelihatan rapi. */
export function konversiOhlc(
  o: Ohlc,
  ke: MataUang,
  kurs: Kurs,
): Ohlc {
  const f = (n: number) => konversi(n, "USD", ke, kurs);
  return {
    buka: f(o.buka),
    tinggi: f(o.tinggi),
    rendah: f(o.rendah),
    tutup: f(o.tutup),
    tutupSebelumnya: o.tutupSebelumnya === undefined ? undefined : f(o.tutupSebelumnya),
  };
}

export interface LevelMilikmu {
  avgHarga?: number;
  stopLoss?: number;
  targetHarga?: number;
}

export function susunLevel(
  o: Ohlc | null,
  hargaKini: number,
  milikmu: LevelMilikmu = {},
): Level[] {
  const hasil: Level[] = [];
  const jarak = (harga: number) =>
    hargaKini > 0 ? ((harga - hargaKini) / hargaKini) * 100 : 0;

  const tambah = (nama: string, harga: number, kelompok: Level["kelompok"]) => {
    if (!Number.isFinite(harga) || harga <= 0) return;
    hasil.push({ nama, harga, kelompok, jarakPersen: bulat(jarak(harga)) });
  };

  if (milikmu.targetHarga) tambah("Targetmu", milikmu.targetHarga, "milikmu");
  if (milikmu.avgHarga) tambah("Rata-rata belimu", milikmu.avgHarga, "milikmu");
  if (milikmu.stopLoss) tambah("Stopmu", milikmu.stopLoss, "milikmu");

  if (o) {
    for (const p of pivotKlasik(o)) tambah(p.nama, p.harga, "pivot");
    for (const f of fibonacci(o)) tambah(f.nama, f.harga, "fibonacci");
  }

  // Diurutkan dari harga tertinggi ke terendah, sama seperti sumbu harga di
  // chart. Membacanya jadi soal menelusuri satu kolom, bukan mencocokkan.
  return hasil.sort((a, b) => b.harga - a.harga);
}

/** Level terdekat di atas dan di bawah harga sekarang. Ini yang paling sering
 *  dicari: batas terdekat ke arah untung dan ke arah rugi. */
export function levelTerdekat(level: readonly Level[], hargaKini: number) {
  const atas = level.filter((l) => l.harga > hargaKini).sort((a, b) => a.harga - b.harga)[0];
  const bawah = level.filter((l) => l.harga < hargaKini).sort((a, b) => b.harga - a.harga)[0];
  return { atas: atas ?? null, bawah: bawah ?? null };
}

/** Posisi harga sekarang di dalam rentang sesi, 0 di rendah dan 1 di tinggi.
 *  Menjawab satu pertanyaan cepat: hari ini ditutup di dekat puncak atau dasar. */
export function posisiDalamRentang(o: Ohlc, hargaKini: number): number | null {
  const rentang = o.tinggi - o.rendah;
  if (!(rentang > 0)) return null;
  return Math.max(0, Math.min(1, (hargaKini - o.rendah) / rentang));
}
