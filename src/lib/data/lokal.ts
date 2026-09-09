"use client";

import { useSyncExternalStore } from "react";
import type { NamaKoleksi } from "./koleksi";

/* Penyimpanan mode lokal.
 *
 * Dipakai saat .env.local belum diisi. Semua dokumen ditulis ke localStorage
 * di bawah satu prefiks.
 *
 * Isinya di-cache di memori dan hanya diurai ulang setelah ada perubahan. Ini
 * bukan optimasi prematur: React membaca snapshot lewat useSyncExternalStore
 * pada setiap render, dan JSON.parse yang menghasilkan larik baru tiap kali
 * dipanggil akan dibaca React sebagai "isinya berubah lagi" tanpa henti.
 */

const PREFIKS = "nakhoda:v1:";
const KOSONG: never[] = [];

const cache = new Map<NamaKoleksi, unknown[]>();
const pelanggan = new Set<() => void>();

function kunci(koleksi: NamaKoleksi) {
  return `${PREFIKS}${koleksi}`;
}

function urai<T>(koleksi: NamaKoleksi): T[] {
  try {
    const mentah = window.localStorage.getItem(kunci(koleksi));
    if (!mentah) return KOSONG;
    const isi = JSON.parse(mentah);
    return Array.isArray(isi) && isi.length ? (isi as T[]) : KOSONG;
  } catch {
    // localStorage bisa melempar di mode penyamaran atau saat kuota penuh, dan
    // isinya bisa saja rusak. Data yang tidak terbaca tidak boleh membuat
    // seluruh app gagal dirender.
    return KOSONG;
  }
}

/** Snapshot koleksi dengan identitas stabil selama isinya belum berubah. */
export function ambilLokal<T>(koleksi: NamaKoleksi): T[] {
  if (typeof window === "undefined") return KOSONG;
  const tersimpan = cache.get(koleksi);
  if (tersimpan) return tersimpan as T[];
  const segar = urai<T>(koleksi);
  cache.set(koleksi, segar);
  return segar;
}

const ambilServer = <T,>(): T[] => KOSONG;

function kabari(koleksi: NamaKoleksi | "*") {
  if (koleksi === "*") cache.clear();
  else cache.delete(koleksi);
  for (const cb of pelanggan) cb();
}

export function tulisLokal<T>(koleksi: NamaKoleksi, baris: T[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(kunci(koleksi), JSON.stringify(baris));
    kabari(koleksi);
    return true;
  } catch {
    return false;
  }
}

export function hapusSemuaLokal() {
  if (typeof window === "undefined") return;
  for (const k of Object.keys(window.localStorage)) {
    if (k.startsWith(PREFIKS)) window.localStorage.removeItem(k);
  }
  kabari("*");
}

function berlangganan(cb: () => void): () => void {
  pelanggan.add(cb);
  const dariTabLain = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIKS)) kabari("*");
  };
  window.addEventListener("storage", dariTabLain);
  return () => {
    pelanggan.delete(cb);
    window.removeEventListener("storage", dariTabLain);
  };
}

/** Membaca satu koleksi lokal sebagai sumber data eksternal. */
export function useKoleksiLokal<T>(koleksi: NamaKoleksi, aktif: boolean): T[] {
  return useSyncExternalStore(
    aktif ? berlangganan : langgananKosong,
    aktif ? () => ambilLokal<T>(koleksi) : ambilServer<T>,
    ambilServer<T>,
  );
}

const langgananKosong = () => () => {};
