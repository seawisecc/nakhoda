"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HargaCache, KursCache, Posisi, Snapshot } from "@/types";
import type { NamaKoleksi } from "./koleksi";
import { useData } from "./penyedia";
import { bangunPosisi, nilaiPosisi, type HargaPasar } from "@/lib/hitung/posisi";
import {
  returnBulanBerjalan, ringkasPortofolio, statistikJurnal,
} from "@/lib/hitung/kinerja";
import { KURS_CADANGAN, type Kurs } from "@/lib/hitung/uang";
import { hariIni } from "@/lib/tanggal";

/** Harga dianggap basi setelah 15 menit; setelah itu app boleh menyegarkan
 *  sendiri saat dibuka. Cukup lama untuk tidak menghabiskan kuota Finnhub,
 *  cukup pendek supaya angka di layar tidak menyesatkan. */
const UMUR_HARGA_MS = 15 * 60 * 1000;

export function usePortofolio() {
  const data = useData();
  const {
    transaksi, arusModal, jurnal, snapshot, hargaCache, kursCache, pengaturan,
    simpan, siap, pengguna,
  } = data;

  const kurs: Kurs = useMemo(() => {
    const c = kursCache.find((k) => k.pasangan === "USD_IDR");
    if (c && c.kurs > 0) {
      return { usdIdr: c.kurs, diperbaruiPada: c.diperbaruiPada, sumber: c.sumber };
    }
    if (pengaturan.kursManualUsdIdr > 0) {
      return { usdIdr: pengaturan.kursManualUsdIdr, sumber: "manual" };
    }
    return KURS_CADANGAN;
  }, [kursCache, pengaturan.kursManualUsdIdr]);

  const petaHarga = useMemo(() => {
    const peta: Record<string, HargaPasar> = {};
    for (const h of hargaCache) {
      peta[h.ticker] = {
        harga: h.harga,
        mataUang: h.mataUang,
        diperbaruiPada: h.diperbaruiPada,
      };
    }
    return peta;
  }, [hargaCache]);

  const posisi = useMemo(
    () => nilaiPosisi(bangunPosisi(transaksi, kurs), petaHarga, kurs),
    [transaksi, petaHarga, kurs],
  );

  const posisiAktif = useMemo(() => posisi.filter((p) => p.qty > 0), [posisi]);

  const ringkasan = useMemo(
    () => ringkasPortofolio(posisi, transaksi, arusModal, pengaturan.mataUangDasar, kurs),
    [posisi, transaksi, arusModal, pengaturan.mataUangDasar, kurs],
  );

  const dietz = useMemo(
    () =>
      returnBulanBerjalan({
        totalNilai: ringkasan.totalNilai,
        transaksi, arus: arusModal, snapshot,
        dasar: pengaturan.mataUangDasar, kurs,
      }),
    [ringkasan.totalNilai, transaksi, arusModal, snapshot, pengaturan.mataUangDasar, kurs],
  );

  const statistik = useMemo(() => statistikJurnal(jurnal), [jurnal]);

  const hargaTertua = useMemo(() => {
    const relevan = hargaCache.filter((h) => posisiAktif.some((p) => p.ticker === h.ticker));
    if (!relevan.length) return null;
    return Math.min(...relevan.map((h) => h.diperbaruiPada));
  }, [hargaCache, posisiAktif]);

  /* ── Menyegarkan harga ──────────────────────────────────────────────── */

  const [menyegarkan, setMenyegarkan] = useState(false);
  const [pesanSegar, setPesanSegar] = useState<string | null>(null);
  const sedangJalan = useRef(false);

  const uid = pengguna?.uid ?? "lokal";

  /** Mengambil harga dan menuliskannya ke cache. Tidak menyentuh state React
   *  sama sekali; itu urusan pemanggilnya. Pemisahan ini yang membuat
   *  penyegaran otomatis saat app dibuka bisa berjalan tanpa mengubah state
   *  secara sinkron di dalam efek. */
  const tarikHarga = useCallback(async (): Promise<HasilTarik> => {
    if (sedangJalan.current) return { status: "sibuk" };
    const daftar = bangunPosisi(transaksi, kurs).filter((p) => p.qty > 0);
    if (!daftar.length) return { status: "kosong" };

    sedangJalan.current = true;
    try {
      return await ambilDanSimpanHarga(daftar, uid, simpan);
    } finally {
      sedangJalan.current = false;
    }
  }, [transaksi, kurs, simpan, uid]);

  /** Dipicu tombol. Menyalakan indikator dan melaporkan hasilnya ke pengguna. */
  const segarkanHarga = useCallback(async () => {
    setMenyegarkan(true);
    setPesanSegar(null);
    try {
      const hasil = await tarikHarga();
      setPesanSegar(pesanUntuk(hasil));
    } finally {
      setMenyegarkan(false);
    }
  }, [tarikHarga]);

  // Menyegarkan sekali saat app dibuka, hanya kalau harga yang ada sudah basi.
  const sudahOtomatis = useRef(false);
  useEffect(() => {
    if (!siap || sudahOtomatis.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!posisiAktif.length) return;
    const basi = hargaTertua === null || Date.now() - hargaTertua > UMUR_HARGA_MS;
    if (!basi) return;
    sudahOtomatis.current = true;
    // Diam-diam: tidak menyalakan indikator, tidak menampilkan pesan. Kalau
    // gagal, harga yang lama tetap tampil dengan cap waktunya sendiri, dan
    // itu sudah cukup memberi tahu bahwa angkanya belum segar.
    void tarikHarga();
  }, [siap, posisiAktif.length, hargaTertua, tarikHarga]);

  /* ── Snapshot harian ────────────────────────────────────────────────── */

  // Modified Dietz butuh nilai portofolio di awal bulan, dan nilai itu tidak
  // bisa direkonstruksi belakangan. Karena itu Nakhoda menyimpan satu foto per
  // hari, tapi hanya ketika angkanya layak dipercaya: ada posisi, harganya
  // segar, dan tidak ada posisi yang harganya gagal diambil.
  const sudahSnapshot = useRef(false);
  useEffect(() => {
    if (!siap || sudahSnapshot.current) return;
    const kini = hariIni();
    if (snapshot.some((s) => s.tanggal === kini)) return;
    if (ringkasan.totalNilai <= 0) return;
    if (posisiAktif.length > 0) {
      if (ringkasan.posisiTanpaHarga > 0) return;
      if (hargaTertua === null || Date.now() - hargaTertua > UMUR_HARGA_MS) return;
    }
    sudahSnapshot.current = true;
    const dok: Snapshot & { id: string } = {
      id: `${pengguna?.uid ?? "lokal"}_${kini}`,
      uid: pengguna?.uid ?? "lokal",
      tanggal: kini,
      nilaiTotal: ringkasan.totalNilai,
      mataUang: ringkasan.mataUang,
      dibuatPada: Date.now(),
    };
    void simpan("snapshot", dok);
  }, [
    siap, snapshot, ringkasan.totalNilai, ringkasan.posisiTanpaHarga,
    ringkasan.mataUang, posisiAktif.length, hargaTertua, simpan, pengguna,
  ]);

  return {
    ...data,
    kurs,
    posisi,
    posisiAktif,
    ringkasan,
    dietz,
    statistik,
    hargaTertua,
    menyegarkan,
    pesanSegar,
    bersihkanPesanSegar: () => setPesanSegar(null),
    segarkanHarga,
  };
}

/* ── Pengambilan harga, di luar React ───────────────────────────────────── */

type HasilTarik =
  | { status: "sibuk" }
  | { status: "kosong" }
  | { status: "galat-server" }
  | { status: "galat-jaringan" }
  | { status: "selesai"; jumlah: number; peringatan: string[] };

function pesanUntuk(h: HasilTarik): string | null {
  switch (h.status) {
    case "sibuk":
      return null;
    case "kosong":
      return "Belum ada posisi terbuka yang perlu diambil harganya.";
    case "galat-server":
      return "Server harga membalas dengan galat. Coba lagi sebentar lagi.";
    case "galat-jaringan":
      return "Gagal menghubungi sumber harga. Periksa koneksi internet.";
    case "selesai":
      if (h.peringatan.length) return h.peringatan.join(" ");
      return h.jumlah
        ? `${h.jumlah} harga diperbarui.`
        : "Tidak ada harga yang berhasil diambil.";
  }
}

async function ambilDanSimpanHarga(
  daftar: readonly Posisi[],
  uid: string,
  simpan: <T extends { id: string }>(koleksi: NamaKoleksi, dok: T) => Promise<void>,
): Promise<HasilTarik> {
  try {
    const [respHarga, respKurs] = await Promise.all([
      fetch("/api/harga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saham: daftar.filter((p) => p.jenisAset === "saham").map((p) => p.ticker),
          kripto: daftar.filter((p) => p.jenisAset === "kripto").map((p) => p.ticker),
          mataUangKripto: "USD",
        }),
      }),
      fetch("/api/kurs"),
    ]);

    const waktu = Date.now();

    if (respKurs.ok) {
      const jk = (await respKurs.json()) as { kurs: number; sumber: string };
      if (jk.kurs > 0) {
        const dok: KursCache = {
          id: "USD_IDR", pasangan: "USD_IDR", uid,
          kurs: jk.kurs, diperbaruiPada: waktu, sumber: jk.sumber,
        };
        await simpan("kursCache", dok);
      }
    }

    if (!respHarga.ok) return { status: "galat-server" };

    const jh = (await respHarga.json()) as {
      harga: {
        ticker: string; jenisAset: "saham" | "kripto";
        harga: number; mataUang: "IDR" | "USD"; sumber: string;
      }[];
      peringatan?: string[];
    };

    for (const h of jh.harga) {
      const dok: HargaCache = {
        id: h.ticker, ticker: h.ticker, uid, jenisAset: h.jenisAset,
        harga: h.harga, mataUang: h.mataUang, diperbaruiPada: waktu, sumber: h.sumber,
      };
      await simpan("hargaCache", dok);
    }

    return { status: "selesai", jumlah: jh.harga.length, peringatan: jh.peringatan ?? [] };
  } catch {
    return { status: "galat-jaringan" };
  }
}
