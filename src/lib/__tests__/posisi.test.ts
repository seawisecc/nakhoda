import { bangunPosisi, nilaiPosisi } from "@/lib/hitung/posisi";
import type { Transaksi } from "@/types";
import { grup, uji, mendekati, samaDengan, benar } from "./uji";

const kurs = { usdIdr: 16_000 };
let urutan = 0;

function tx(p: Partial<Transaksi>): Transaksi {
  return {
    id: `t${++urutan}`,
    uid: "u",
    ticker: "NVDA",
    jenisAset: "saham",
    sisi: "beli",
    tanggal: "2026-01-01",
    qty: 1,
    harga: 100,
    fee: 0,
    mataUang: "USD",
    dibuatPada: urutan,
    ...p,
  };
}

grup("bangunPosisi", () => {
  uji("biaya rata-rata dari dua pembelian harga berbeda", () => {
    const p = bangunPosisi([
      tx({ qty: 10, harga: 100 }),
      tx({ qty: 10, harga: 200, tanggal: "2026-01-05" }),
    ], kurs)[0];
    mendekati(p.qty, 20);
    mendekati(p.avgHarga, 150);
    mendekati(p.biayaTotal, 3000);
  });

  uji("fee beli masuk ke basis biaya", () => {
    const p = bangunPosisi([tx({ qty: 10, harga: 100, fee: 50 })], kurs)[0];
    mendekati(p.biayaTotal, 1050);
    mendekati(p.avgHarga, 105);
  });

  uji("jual sebagian: laba terealisasi pakai biaya rata-rata, sisa basis ikut turun", () => {
    const p = bangunPosisi([
      tx({ qty: 10, harga: 100 }),
      tx({ qty: 10, harga: 200, tanggal: "2026-01-05" }),
      // Jual 5 unit di 250. Basis rata-rata 150, jadi laba 5 × 100 = 500.
      tx({ qty: 5, harga: 250, sisi: "jual", tanggal: "2026-01-10" }),
    ], kurs)[0];
    mendekati(p.labaTerealisasi, 500);
    mendekati(p.qty, 15);
    mendekati(p.avgHarga, 150, 1e-9);
    mendekati(p.biayaTotal, 2250);
  });

  uji("fee jual mengurangi laba terealisasi", () => {
    const p = bangunPosisi([
      tx({ qty: 10, harga: 100 }),
      tx({ qty: 10, harga: 150, sisi: "jual", fee: 20, tanggal: "2026-02-01" }),
    ], kurs)[0];
    mendekati(p.labaTerealisasi, 480);
  });

  uji("posisi ditutup penuh: qty dan biaya jadi nol bersih", () => {
    const p = bangunPosisi([
      tx({ qty: 3, harga: 100 }),
      tx({ qty: 3, harga: 120, sisi: "jual", tanggal: "2026-02-01" }),
    ], kurs)[0];
    samaDengan(p.qty, 0);
    samaDengan(p.biayaTotal, 0);
    samaDengan(p.avgHarga, 0);
    mendekati(p.labaTerealisasi, 60);
  });

  uji("urutan input acak tetap menghasilkan angka yang sama", () => {
    const daftar = [
      tx({ qty: 10, harga: 100, tanggal: "2026-01-01" }),
      tx({ qty: 10, harga: 200, tanggal: "2026-01-05" }),
      tx({ qty: 5, harga: 250, sisi: "jual", tanggal: "2026-01-10" }),
    ];
    const maju = bangunPosisi(daftar, kurs)[0];
    const mundur = bangunPosisi([...daftar].reverse(), kurs)[0];
    mendekati(mundur.avgHarga, maju.avgHarga);
    mendekati(mundur.labaTerealisasi, maju.labaTerealisasi);
  });

  uji("saham fraksional kecil tidak kehilangan ketelitian", () => {
    const p = bangunPosisi([
      tx({ qty: 0.0125, harga: 228.45 }),
      tx({ qty: 0.0075, harga: 231.2, tanggal: "2026-01-03" }),
    ], kurs)[0];
    mendekati(p.qty, 0.02, 1e-12);
    mendekati(p.biayaTotal, 0.0125 * 228.45 + 0.0075 * 231.2, 1e-12);
  });

  uji("ticker beda mata uang ditandai campurMataUang dan dikonversi", () => {
    const p = bangunPosisi([
      tx({ ticker: "BTC", jenisAset: "kripto", qty: 1, harga: 100, mataUang: "USD" }),
      tx({
        ticker: "BTC", jenisAset: "kripto", qty: 1, harga: 1_600_000,
        mataUang: "IDR", tanggal: "2026-01-05",
      }),
    ], kurs)[0];
    benar(p.campurMataUang, "harus ditandai campur");
    samaDengan(p.mataUang, "USD");
    // 1.600.000 IDR pada kurs 16.000 sama dengan 100 USD, jadi rata-ratanya 100.
    mendekati(p.avgHarga, 100);
  });

  uji("jual melebihi kepemilikan tidak menghasilkan qty negatif", () => {
    const p = bangunPosisi([
      tx({ qty: 2, harga: 100 }),
      tx({ qty: 5, harga: 100, sisi: "jual", tanggal: "2026-02-01" }),
    ], kurs)[0];
    samaDengan(p.qty, 0);
    benar(p.biayaTotal === 0, "basis harus habis, bukan negatif");
  });

  uji("posisi aktif diurutkan sebelum posisi tertutup", () => {
    const hasil = bangunPosisi([
      tx({ ticker: "AAA", qty: 1, harga: 10 }),
      tx({ ticker: "AAA", qty: 1, harga: 12, sisi: "jual", tanggal: "2026-03-01" }),
      tx({ ticker: "BBB", qty: 1, harga: 10 }),
    ], kurs);
    samaDengan(hasil[0].ticker, "BBB");
  });
});

grup("nilaiPosisi", () => {
  uji("laba belum terealisasi dan persennya", () => {
    const posisi = bangunPosisi([tx({ qty: 10, harga: 100 })], kurs);
    const p = nilaiPosisi(posisi, {
      NVDA: { harga: 130, mataUang: "USD", diperbaruiPada: 1 },
    }, kurs)[0];
    mendekati(p.nilaiPasar!, 1300);
    mendekati(p.labaBelumTerealisasi!, 300);
    mendekati(p.labaBelumTerealisasiPersen!, 30);
  });

  uji("harga dalam mata uang lain dikonversi ke mata uang posisi", () => {
    const posisi = bangunPosisi([
      tx({ ticker: "BTC", jenisAset: "kripto", qty: 2, harga: 50, mataUang: "USD" }),
    ], kurs);
    const p = nilaiPosisi(posisi, {
      BTC: { harga: 1_600_000, mataUang: "IDR", diperbaruiPada: 1 },
    }, kurs)[0];
    mendekati(p.hargaTerakhir!, 100);
    mendekati(p.nilaiPasar!, 200);
  });

  uji("tanpa harga, posisi dibiarkan tanpa nilai pasar", () => {
    const posisi = bangunPosisi([tx({ qty: 10, harga: 100 })], kurs);
    const p = nilaiPosisi(posisi, {}, kurs)[0];
    samaDengan(p.nilaiPasar, undefined);
  });

  uji("posisi tertutup tidak menghasilkan persentase tak hingga", () => {
    const posisi = bangunPosisi([
      tx({ qty: 1, harga: 100 }),
      tx({ qty: 1, harga: 110, sisi: "jual", tanggal: "2026-02-01" }),
    ], kurs);
    const p = nilaiPosisi(posisi, {
      NVDA: { harga: 130, mataUang: "USD", diperbaruiPada: 1 },
    }, kurs)[0];
    benar(Number.isFinite(p.labaBelumTerealisasiPersen!), "persen harus terhingga");
    samaDengan(p.labaBelumTerealisasiPersen, 0);
  });
});
