"use client";

import type { ArusModal, JurnalEntri, Saran, Snapshot, Transaksi } from "@/types";
import { hariIni, tambahHari } from "@/lib/tanggal";

/** Data contoh.
 *
 *  Ada supaya Nakhoda bisa dinilai sebagai app sebelum ada satu pun angka
 *  sungguhan di dalamnya: dasbor kosong tidak memberi tahu apa pun tentang
 *  apakah tata letaknya bekerja. Angkanya sengaja dibuat masuk akal, bukan
 *  spektakuler, supaya tidak menciptakan harapan yang salah.
 *
 *  Semua tanggal relatif terhadap hari ini, jadi contohnya tidak pernah basi. */
export function dataContoh(uid: string): {
  transaksi: Transaksi[];
  arusModal: ArusModal[];
  jurnal: JurnalEntri[];
  saran: Saran[];
  snapshot: Snapshot[];
} {
  // Modal sengaja dibuat lebih besar dari total belanja. Portofolio contoh
  // yang kasnya negatif bukan sekadar tidak realistis, dia menampilkan
  // peringatan "modal kurang" di dasbor dan bikin orang mengira app-nya rusak.
  const kini = hariIni();
  const h = (mundur: number) => tambahHari(kini, -mundur);
  let n = 0;
  const id = (awalan: string) => `contoh-${awalan}-${++n}`;
  const t = Date.now();

  return {
    arusModal: [
      { id: id("modal"), uid, tanggal: h(120), jumlah: 180_000_000, mataUang: "IDR", tipe: "awal", catatan: "Modal awal", dibuatPada: t },
      { id: id("modal"), uid, tanggal: h(58), jumlah: 70_000_000, mataUang: "IDR", tipe: "setor", catatan: "Bonus proyek", dibuatPada: t + 1 },
      { id: id("modal"), uid, tanggal: h(20), jumlah: 5_000_000, mataUang: "IDR", tipe: "tarik", catatan: "Kebutuhan mendadak", dibuatPada: t + 2 },
    ],
    transaksi: [
      { id: id("tx"), uid, ticker: "NVDA", jenisAset: "saham", sisi: "beli", tanggal: h(110), qty: 12, harga: 118.4, fee: 1.2, mataUang: "USD", dibuatPada: t },
      { id: id("tx"), uid, ticker: "NVDA", jenisAset: "saham", sisi: "beli", tanggal: h(74), qty: 6, harga: 131.9, fee: 0.8, mataUang: "USD", dibuatPada: t + 1 },
      { id: id("tx"), uid, ticker: "MSFT", jenisAset: "saham", sisi: "beli", tanggal: h(96), qty: 5, harga: 402.15, fee: 1, mataUang: "USD", dibuatPada: t + 2 },
      { id: id("tx"), uid, ticker: "AAPL", jenisAset: "saham", sisi: "beli", tanggal: h(88), qty: 8, harga: 216.7, fee: 1, mataUang: "USD", dibuatPada: t + 3 },
      { id: id("tx"), uid, ticker: "AAPL", jenisAset: "saham", sisi: "jual", tanggal: h(31), qty: 8, harga: 238.4, fee: 1, mataUang: "USD", catatan: "Target kena", dibuatPada: t + 4 },
      { id: id("tx"), uid, ticker: "BTC", jenisAset: "kripto", sisi: "beli", tanggal: h(102), qty: 0.055, harga: 61_400, fee: 6, mataUang: "USD", dibuatPada: t + 5 },
      { id: id("tx"), uid, ticker: "ETH", jenisAset: "kripto", sisi: "beli", tanggal: h(65), qty: 1.4, harga: 2_480, fee: 3, mataUang: "USD", dibuatPada: t + 6 },
      { id: id("tx"), uid, ticker: "SOL", jenisAset: "kripto", sisi: "beli", tanggal: h(44), qty: 22, harga: 148.2, fee: 2, mataUang: "USD", dibuatPada: t + 7 },
      { id: id("tx"), uid, ticker: "SOL", jenisAset: "kripto", sisi: "jual", tanggal: h(12), qty: 8, harga: 171.5, fee: 1.5, mataUang: "USD", catatan: "Ambil sebagian", dibuatPada: t + 8 },
    ],
    jurnal: [
      {
        id: id("jrn"), uid, ticker: "AAPL", jenisAset: "saham", tanggal: h(88), mataUang: "USD",
        thesisTeknikal: "Breakout dari range dua bulan di 214, volume konfirmasi, MA50 baru menyilang MA200.",
        thesisFundamental: "Siklus ganti perangkat menjelang rilis besar, margin layanan terus melebar.",
        hargaEntry: 216.7, stopLoss: 205, targetHarga: 240,
        status: "tertutup", hasil: "untung", hargaKeluar: 238.4, tanggalKeluar: h(31),
        pelajaran: "Target hampir kena persis. Yang keliru: aku hampir keluar duluan di 228 karena panik, padahal thesis belum batal.",
        dibuatPada: t,
      },
      {
        id: id("jrn"), uid, ticker: "SOL", jenisAset: "kripto", tanggal: h(44), mataUang: "USD",
        thesisTeknikal: "Retest support 145 yang sebelumnya jadi resistance, RSI keluar dari oversold.",
        thesisFundamental: "Aktivitas jaringan dan volume DEX naik dua kuartal beruntun.",
        hargaEntry: 148.2, stopLoss: 132, targetHarga: 190,
        status: "tertutup", hasil: "untung", hargaKeluar: 171.5, tanggalKeluar: h(12),
        pelajaran: "Keluar sebelum target karena momentum melemah. Keputusannya benar, tapi seharusnya ditulis dulu di rencana, bukan diputuskan mendadak.",
        dibuatPada: t + 1,
      },
      {
        id: id("jrn"), uid, ticker: "NVDA", jenisAset: "saham", tanggal: h(74), mataUang: "USD",
        thesisTeknikal: "Menambah posisi di pullback ke MA20 yang belum pernah ditembus sejak Mei.",
        thesisFundamental: "Backlog data center masih penuh, guidance dinaikkan dua kuartal berturut-turut.",
        hargaEntry: 131.9, stopLoss: 118, targetHarga: 168,
        status: "terbuka",
        dibuatPada: t + 2,
      },
    ],
    snapshot: riwayatNilai(uid, kini),
    saran: [
      {
        id: id("saran"), uid, ticker: "AMD", jenisAset: "saham", tanggal: h(3), sumber: "claude-code",
        rekomendasi: "pantau",
        catatanTeknikal: "Konsolidasi ketat di bawah resistance 178. Belum ada breakout, volume masih menurun.",
        catatanFundamental: "Pangsa pasar server naik, tapi valuasi sudah memperhitungkan sebagian besar pertumbuhan itu.",
        entrySaran: 178.5, stopSaran: 164, targetSaran: 212, mataUang: "USD",
        status: "menunggu", dibuatPada: t,
      },
      {
        id: id("saran"), uid, ticker: "ETH", jenisAset: "kripto", tanggal: h(9), sumber: "claude-code",
        rekomendasi: "tahan",
        catatanTeknikal: "Masih di dalam range besar 2.200 sampai 2.900. Tidak ada sinyal yang layak ditindaklanjuti.",
        catatanFundamental: "Biaya transaksi turun setelah pembaruan terakhir, tapi arus dana masuk melambat.",
        mataUang: "USD", status: "menunggu", dibuatPada: t + 1,
      },
    ],
  };
}

/** Riwayat nilai portofolio contoh, 90 hari ke belakang.
 *
 *  Ada karena grafik nilai portofolio butuh minimal dua hari data, dan tanpa
 *  ini bagian dasbor yang paling banyak memakan ruang justru yang paling tidak
 *  bisa dinilai. Ikut mengisi BMV Modified Dietz, jadi return bulan berjalan
 *  di data contoh tampil sebagai angka presisi, bukan perkiraan.
 *
 *  Dua hal yang harus dipegang, dan keduanya pernah salah waktu ditulis:
 *
 *  1. Bentuknya deterministik, bukan Math.random. Data contoh yang berubah
 *     bentuk tiap kali dimuat bikin dua tangkapan layar dari app yang sama
 *     terlihat seperti dua app berbeda.
 *  2. Ujungnya harus mendarat dekat nilai portofolio yang benar-benar dihitung
 *     dari transaksi contoh. Kalau tidak, snapshot 1 September akan jadi BMV
 *     yang jauh lebih tinggi dari nilai hari ini, dan dasbor akan melaporkan
 *     return bulanan minus belasan persen padahal tidak ada yang rugi.
 *     Karena itu kenaikannya ditulis sebagai tren lurus dengan riak di
 *     atasnya, bukan sebagai bunga berbunga yang dibiarkan lari sendiri.
 */
function riwayatNilai(uid: string, kini: string): Snapshot[] {
  const HARI = 90;
  const AWAL = 180_000_000;
  /** Hasil trading selama 90 hari, di luar setoran dan penarikan. */
  const HASIL_TRADING = 0.04;
  /** Besar riak harian relatif terhadap modal awal. */
  const RIAK = 0.012;

  const hasil: Snapshot[] = [];

  for (let i = HARI; i >= 1; i -= 1) {
    const t = HARI - i;
    const maju = t / HARI;
    // Dua sinus berbeda periode: satu gelombang panjang, satu pendek. Yang
    // dihasilkan bergerak seperti pasar tanpa pernah melompat.
    const riak = Math.sin(t / 9) * 0.62 + Math.sin(t / 2.3) * 0.38;
    let nilai = AWAL * (1 + HASIL_TRADING * maju + RIAK * riak);

    // Setoran dan penarikan contoh ikut menggeser nilai portofolio, persis
    // seperti di dunia nyata. Justru itu yang bikin Modified Dietz ada
    // gunanya untuk dilihat di halaman ini.
    if (i <= 58) nilai += 70_000_000;
    if (i <= 20) nilai -= 5_000_000;

    hasil.push({
      id: `contoh-snap-${i}`,
      uid,
      tanggal: tambahHari(kini, -i),
      nilaiTotal: Math.round(nilai),
      mataUang: "IDR",
      dibuatPada: Date.now(),
    });
  }
  return hasil;
}
