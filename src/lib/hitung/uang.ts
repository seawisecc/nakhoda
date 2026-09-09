import type { MataUang } from "@/types";

/** Kurs yang dipakai untuk seluruh kalkulasi dalam satu render. */
export interface Kurs {
  /** Berapa rupiah untuk satu dolar. */
  usdIdr: number;
  diperbaruiPada?: number;
  sumber?: string;
}

export const KURS_CADANGAN: Kurs = { usdIdr: 16_300, sumber: "cadangan" };

/** Konversi antar mata uang memakai kurs terkini.
 *
 *  Catatan penting soal ketelitian: Nakhoda tidak menyimpan kurs historis.
 *  Nilai portofolio hari ini benar, tapi nilai transaksi lama yang dikonversi
 *  lintas mata uang memakai kurs hari ini, bukan kurs hari transaksi itu.
 *  Untuk pemakaian normal (satu ticker satu mata uang) ini tidak pernah
 *  terpakai; yang terdampak hanya ticker yang pernah dibeli dalam dua mata
 *  uang, dan posisi seperti itu ditandai `campurMataUang` di UI. */
export function konversi(
  jumlah: number,
  dari: MataUang,
  ke: MataUang,
  kurs: Kurs,
): number {
  if (dari === ke) return jumlah;
  const laju = kurs.usdIdr > 0 ? kurs.usdIdr : KURS_CADANGAN.usdIdr;
  return dari === "USD" ? jumlah * laju : jumlah / laju;
}
