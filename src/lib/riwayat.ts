"use client";

import { useEffect, useState } from "react";
import type { JenisAset } from "@/types";
import type { Lilin } from "@/lib/hitung/sinyal";

export type HasilAmbilRiwayat =
  | { ok: true; batang: Lilin[]; sumber: string }
  | { ok: false; galat: string };

/** Satu permintaan ke /api/riwayat. Dipakai hook di bawah dan pemindai
 *  posisi, supaya pesan galatnya sama di kedua tempat. */
export async function ambilRiwayat(ticker: string, jenisAset: JenisAset): Promise<HasilAmbilRiwayat> {
  try {
    const r = await fetch(`/api/riwayat?ticker=${encodeURIComponent(ticker)}&jenis=${jenisAset}`);
    const j = await r.json();
    if (!r.ok) return { ok: false, galat: j.galat ?? "Riwayat harga tidak tersedia." };
    return { ok: true, batang: j.batang, sumber: j.sumber };
  } catch {
    return { ok: false, galat: "Gagal mengambil riwayat harga." };
  }
}

/** Riwayat harian dari /api/riwayat, selalu USD.
 *
 *  Pemakainya di-remount setiap ticker berubah (lewat prop key), jadi
 *  keadaan awal cukup ditulis di useState. Menyetelnya ulang di dalam efek
 *  akan sempat menampilkan data ticker sebelumnya selama satu render. */
export function useRiwayat(ticker: string, jenisAset: JenisAset) {
  const [batang, setBatang] = useState<Lilin[] | null>(null);
  const [sumber, setSumber] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let batal = false;
    ambilRiwayat(ticker, jenisAset).then((h) => {
      if (batal) return;
      if (h.ok) {
        setBatang(h.batang);
        setSumber(h.sumber);
      } else {
        setGalat(h.galat);
      }
      setMemuat(false);
    });
    return () => { batal = true; };
  }, [ticker, jenisAset]);

  return { batang, sumber, memuat, galat };
}
