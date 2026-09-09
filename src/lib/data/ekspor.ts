"use client";

import type {
  ArusModal, JurnalEntri, Pengaturan, Saran, Snapshot, Transaksi,
} from "@/types";
import { hariIni } from "@/lib/tanggal";

export interface BerkasCadangan {
  aplikasi: "nakhoda";
  versi: 1;
  dibuatPada: string;
  transaksi: Transaksi[];
  arusModal: ArusModal[];
  jurnal: JurnalEntri[];
  saran: Saran[];
  snapshot: Snapshot[];
  pengaturan: Pengaturan;
}

/** Ekspor JSON.
 *
 *  Tetap dibuat meskipun data sudah ada di cloud. Firebase melindungi dari
 *  kehilangan perangkat, bukan dari salah hapus, aturan keamanan yang keliru,
 *  atau project yang tidak sengaja dihapus. Berkas di laptop adalah jaring
 *  kedua yang tidak bergantung pada akun mana pun. */
export function unduhCadangan(isi: Omit<BerkasCadangan, "aplikasi" | "versi" | "dibuatPada">) {
  const berkas: BerkasCadangan = {
    aplikasi: "nakhoda",
    versi: 1,
    dibuatPada: new Date().toISOString(),
    ...isi,
  };
  const gumpalan = new Blob([JSON.stringify(berkas, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(gumpalan);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nakhoda-cadangan-${hariIni()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Melepas URL terlalu cepat bisa membatalkan unduhan di Safari.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Ekspor CSV transaksi, untuk dibuka di spreadsheet.
 *  Pemisahnya titik koma karena Excel berlokal Indonesia membaca koma sebagai
 *  pemisah desimal, dan file berkoma akan berantakan di sana. */
export function unduhCsvTransaksi(transaksi: Transaksi[]) {
  const kepala = ["tanggal", "ticker", "jenis_aset", "aksi", "qty", "harga", "fee", "mata_uang", "catatan"];
  const baris = [...transaksi]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((t) =>
      [
        t.tanggal, t.ticker, t.jenisAset, t.sisi,
        String(t.qty).replace(".", ","),
        String(t.harga).replace(".", ","),
        String(t.fee ?? 0).replace(".", ","),
        t.mataUang,
        `"${(t.catatan ?? "").replace(/"/g, '""')}"`,
      ].join(";"),
    );
  const isi = "﻿" + [kepala.join(";"), ...baris].join("\n");
  const url = URL.createObjectURL(new Blob([isi], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `nakhoda-transaksi-${hariIni()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function bacaCadangan(teks: string): BerkasCadangan {
  const isi = JSON.parse(teks) as Partial<BerkasCadangan>;
  if (isi.aplikasi !== "nakhoda") {
    throw new Error("Berkas ini bukan cadangan Nakhoda.");
  }
  if (isi.versi !== 1) {
    throw new Error(`Versi cadangan ${isi.versi} belum didukung.`);
  }
  const larik = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return {
    aplikasi: "nakhoda",
    versi: 1,
    dibuatPada: isi.dibuatPada ?? "",
    transaksi: larik<Transaksi>(isi.transaksi),
    arusModal: larik<ArusModal>(isi.arusModal),
    jurnal: larik<JurnalEntri>(isi.jurnal),
    saran: larik<Saran>(isi.saran),
    snapshot: larik<Snapshot>(isi.snapshot),
    pengaturan: isi.pengaturan as Pengaturan,
  };
}
