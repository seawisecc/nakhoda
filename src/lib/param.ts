"use client";

import { useSyncExternalStore } from "react";

/* Parameter kueri sebagai sumber data eksternal.
 *
 * URL adalah keadaan yang hidup di luar React, jadi dibaca lewat
 * useSyncExternalStore, bukan lewat useState di dalam useEffect. Bedanya
 * bukan soal gaya: dengan cara ini nilainya sudah benar sejak render klien
 * pertama, render server tetap konsisten karena snapshot server selalu string
 * kosong, dan tidak ada render berantai setelah komponen terpasang.
 *
 * Yang dipakai di sini cuma isyarat sekali jalan: "buka formulir baru" dari
 * pintasan PWA dan dari tautan antar halaman.
 */

const pelanggan = new Set<() => void>();

function berlangganan(cb: () => void): () => void {
  pelanggan.add(cb);
  // popstate menangkap tombol kembali; bersihkanParam memberi tahu sendiri
  // karena replaceState tidak memicu event apa pun.
  window.addEventListener("popstate", cb);
  return () => {
    pelanggan.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

function kabari() {
  for (const cb of pelanggan) cb();
}

const ambilKlien = () => window.location.search;
const ambilServer = () => "";

/** Nilai satu parameter kueri, ikut berubah kalau parameternya dibersihkan. */
export function useParamKueri(nama: string): string | null {
  const kueri = useSyncExternalStore(berlangganan, ambilKlien, ambilServer);
  return new URLSearchParams(kueri).get(nama);
}

/** Menghapus parameter dari bilah alamat tanpa memuat ulang halaman.
 *  Dipanggil saat panel yang dibuka oleh parameter itu ditutup, supaya
 *  menyegarkan halaman tidak membuka panel yang sama lagi. */
export function bersihkanParam(nama: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(nama)) return;
  url.searchParams.delete(nama);
  window.history.replaceState({}, "", url.pathname + url.search);
  kabari();
}
