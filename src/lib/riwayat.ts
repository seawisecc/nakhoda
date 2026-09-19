"use client";

import { useEffect, useState } from "react";
import type { JenisAset } from "@/types";
import type { Lilin } from "@/lib/hitung/sinyal";

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
    fetch(`/api/riwayat?ticker=${encodeURIComponent(ticker)}&jenis=${jenisAset}`)
      .then(async (r) => {
        const j = await r.json();
        if (batal) return;
        if (!r.ok) {
          setGalat(j.galat ?? "Riwayat harga tidak tersedia.");
          return;
        }
        setBatang(j.batang);
        setSumber(j.sumber);
      })
      .catch(() => {
        if (!batal) setGalat("Gagal mengambil riwayat harga.");
      })
      .finally(() => {
        if (!batal) setMemuat(false);
      });
    return () => { batal = true; };
  }, [ticker, jenisAset]);

  return { batang, sumber, memuat, galat };
}
