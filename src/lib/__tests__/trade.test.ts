import { bangunTrade, statistikTrade, usulkanPenutupan } from "@/lib/hitung/trade";
import type { JurnalEntri, Transaksi } from "@/types";
import { grup, uji, mendekati, samaDengan, benar } from "./uji";

const kurs = { usdIdr: 16_000 };
const KINI = "2026-03-01";
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

function entri(p: Partial<JurnalEntri>): JurnalEntri {
  return {
    id: `j${++urutan}`,
    uid: "u",
    ticker: "NVDA",
    jenisAset: "saham",
    tanggal: "2026-01-01",
    mataUang: "USD",
    thesisTeknikal: "",
    thesisFundamental: "",
    hargaEntry: 100,
    stopLoss: 90,
    targetHarga: 130,
    status: "terbuka",
    dibuatPada: urutan,
    ...p,
  };
}

grup("bangunTrade", () => {
  uji("beli lalu jual habis jadi satu trade selesai", () => {
    const t = bangunTrade(
      [
        tx({ qty: 10, harga: 100, tanggal: "2026-01-01" }),
        tx({ qty: 10, harga: 130, sisi: "jual", tanggal: "2026-01-31" }),
      ],
      kurs,
      KINI,
    );
    samaDengan(t.length, 1);
    benar(t[0].selesai, "trade harusnya selesai");
    mendekati(t[0].hasil as number, 300);
    mendekati(t[0].modal, 1000);
    mendekati(t[0].hasilPersen as number, 30);
    samaDengan(t[0].hariHold, 30);
    samaDengan(t[0].tanggalKeluar, "2026-01-31");
  });

  uji("fee dua arah mengurangi hasil dan menaikkan biaya masuk", () => {
    const t = bangunTrade(
      [
        tx({ qty: 10, harga: 100, fee: 3 }),
        tx({ qty: 10, harga: 110, sisi: "jual", fee: 3, tanggal: "2026-01-15" }),
      ],
      kurs,
      KINI,
    )[0];
    // Masuk 1003, keluar 1100 dikurangi fee 3 jadi 1097, laba bersih 94.
    mendekati(t.modal, 1003);
    mendekati(t.hasil as number, 94);
    mendekati(t.hargaMasukRata, 100.3);
    mendekati(t.hargaKeluarRata as number, 109.7);
  });

  uji("beli dua kali dan jual sebagian tetap satu siklus", () => {
    const t = bangunTrade(
      [
        tx({ qty: 10, harga: 100, tanggal: "2026-01-01" }),
        tx({ qty: 10, harga: 200, tanggal: "2026-01-10" }),
        tx({ qty: 5, harga: 250, sisi: "jual", tanggal: "2026-01-20" }),
        tx({ qty: 15, harga: 300, sisi: "jual", tanggal: "2026-02-01" }),
      ],
      kurs,
      KINI,
    );
    samaDengan(t.length, 1);
    // Basis rata-rata 150. Jual 5 di 250 memberi 500, jual 15 di 300 memberi 2250.
    mendekati(t[0].hasil as number, 2750);
    mendekati(t[0].qty, 20);
    samaDengan(t[0].hariHold, 31);
    samaDengan(t[0].idTransaksi.length, 4);
  });

  uji("beli lagi setelah posisi ditutup memulai siklus baru", () => {
    const t = bangunTrade(
      [
        tx({ qty: 10, harga: 100, tanggal: "2026-01-01" }),
        tx({ qty: 10, harga: 120, sisi: "jual", tanggal: "2026-01-10" }),
        tx({ qty: 10, harga: 130, tanggal: "2026-02-01" }),
        tx({ qty: 10, harga: 125, sisi: "jual", tanggal: "2026-02-10" }),
      ],
      kurs,
      KINI,
    );
    samaDengan(t.length, 2);
    // Diurutkan dari yang paling baru keluarnya.
    mendekati(t[0].hasil as number, -50);
    mendekati(t[1].hasil as number, 200);
  });

  uji("siklus yang masih berjalan dihitung sampai hari ini", () => {
    const t = bangunTrade([tx({ qty: 10, harga: 100, tanggal: "2026-02-01" })], kurs, KINI)[0];
    benar(!t.selesai, "harusnya belum selesai");
    samaDengan(t.tanggalKeluar, null);
    samaDengan(t.hariHold, 28);
    samaDengan(t.hargaKeluarRata, null);
  });

  uji("jual tanpa pembelian tercatat ditandai tidak lengkap, hasilnya null", () => {
    const t = bangunTrade(
      [tx({ qty: 5, harga: 200, sisi: "jual", tanggal: "2026-01-05" })],
      kurs,
      KINI,
    )[0];
    benar(t.basisTidakLengkap, "harusnya ditandai tidak lengkap");
    samaDengan(t.hasil, null);
    samaDengan(t.hasilPersen, null);
  });

  uji("jual melebihi yang dipegang juga ditandai tidak lengkap", () => {
    const t = bangunTrade(
      [
        tx({ qty: 5, harga: 100 }),
        tx({ qty: 8, harga: 150, sisi: "jual", tanggal: "2026-01-10" }),
      ],
      kurs,
      KINI,
    )[0];
    benar(t.basisTidakLengkap, "harusnya ditandai tidak lengkap");
    samaDengan(t.hasil, null);
  });

  uji("transaksi mata uang lain dikonversi ke mata uang siklus", () => {
    const t = bangunTrade(
      [
        tx({ ticker: "BTC", jenisAset: "kripto", qty: 1, harga: 1_600_000_000, mataUang: "IDR" }),
        tx({
          ticker: "BTC", jenisAset: "kripto", qty: 1, harga: 110_000,
          mataUang: "USD", sisi: "jual", tanggal: "2026-01-20",
        }),
      ],
      kurs,
      KINI,
    )[0];
    samaDengan(t.mataUang, "IDR");
    // 110.000 USD × 16.000 = 1,76 miliar, dikurangi modal 1,6 miliar.
    mendekati(t.hasil as number, 160_000_000);
  });
});

grup("statistikTrade", () => {
  const daftar = bangunTrade(
    [
      // Menang 300 dalam 30 hari.
      tx({ ticker: "AAA", qty: 10, harga: 100, tanggal: "2026-01-01" }),
      tx({ ticker: "AAA", qty: 10, harga: 130, sisi: "jual", tanggal: "2026-01-31" }),
      // Kalah 100 dalam 10 hari.
      tx({ ticker: "BBB", qty: 10, harga: 100, tanggal: "2026-01-01" }),
      tx({ ticker: "BBB", qty: 10, harga: 90, sisi: "jual", tanggal: "2026-01-11" }),
      // Menang 100 dalam 20 hari.
      tx({ ticker: "CCC", qty: 10, harga: 100, tanggal: "2026-01-01" }),
      tx({ ticker: "CCC", qty: 10, harga: 110, sisi: "jual", tanggal: "2026-01-21" }),
      // Masih terbuka.
      tx({ ticker: "DDD", qty: 10, harga: 100, tanggal: "2026-02-01" }),
      // Basis tidak lengkap, harus dikeluarkan dari statistik.
      tx({ ticker: "EEE", qty: 10, harga: 500, sisi: "jual", tanggal: "2026-02-02" }),
    ],
    kurs,
    KINI,
  );
  const s = statistikTrade(daftar, "USD", kurs);

  uji("win rate hanya dari trade selesai yang basisnya lengkap", () => {
    samaDengan(s.total, 3);
    samaDengan(s.menang, 2);
    samaDengan(s.kalah, 1);
    mendekati(s.winRate as number, (2 / 3) * 100);
    samaDengan(s.tidakLengkap, 1);
    samaDengan(s.terbuka, 1);
  });

  uji("rata-rata dan faktor untung memakai uang, bukan jumlah trade", () => {
    mendekati(s.totalHasil, 300);
    mendekati(s.rataMenang as number, 200);
    mendekati(s.rataKalah as number, -100);
    mendekati(s.faktorUntung as number, 4);
  });

  uji("lama hold rata-rata dipisah antara menang dan kalah", () => {
    mendekati(s.rataHariHold as number, 20);
    mendekati(s.rataHariMenang as number, 25);
    mendekati(s.rataHariKalah as number, 10);
    samaDengan(s.hariHoldTerlama, 30);
  });

  uji("tanpa trade rugi, faktor untung tidak terdefinisi dan bukan tak hingga", () => {
    const hanyaMenang = statistikTrade(
      bangunTrade(
        [
          tx({ ticker: "FFF", qty: 1, harga: 100 }),
          tx({ ticker: "FFF", qty: 1, harga: 120, sisi: "jual", tanggal: "2026-01-10" }),
        ],
        kurs,
        KINI,
      ),
      "USD",
      kurs,
    );
    samaDengan(hanyaMenang.faktorUntung, null);
  });

  uji("statistik kosong saat belum ada trade selesai", () => {
    const s2 = statistikTrade([], "USD", kurs);
    samaDengan(s2.winRate, null);
    samaDengan(s2.rataHariHold, null);
    samaDengan(s2.total, 0);
  });

  uji("hasil dikonversi ke mata uang dasar", () => {
    const idr = statistikTrade(daftar, "IDR", kurs);
    mendekati(idr.totalHasil, 300 * 16_000);
  });
});

grup("usulkanPenutupan", () => {
  const transaksi = [
    tx({ ticker: "NVDA", qty: 10, harga: 100, tanggal: "2026-01-01" }),
    tx({ ticker: "NVDA", qty: 10, harga: 130, sisi: "jual", tanggal: "2026-01-31" }),
  ];
  const trade = bangunTrade(transaksi, kurs, KINI);

  uji("entri terbuka yang posisinya sudah ditutup diusulkan", () => {
    const u = usulkanPenutupan([entri({ tanggal: "2026-01-01" })], trade, kurs);
    samaDengan(u.length, 1);
    samaDengan(u[0].tanggalKeluar, "2026-01-31");
    samaDengan(u[0].hasil, "untung");
    mendekati(u[0].hargaKeluar, 130);
  });

  uji("entri yang sudah tertutup tidak diusulkan lagi", () => {
    const u = usulkanPenutupan(
      [entri({ status: "tertutup", hasil: "untung", hargaKeluar: 130 })],
      trade,
      kurs,
    );
    samaDengan(u.length, 0);
  });

  uji("entri yang ditulis setelah posisi ditutup bukan trade itu", () => {
    const u = usulkanPenutupan([entri({ tanggal: "2026-02-15" })], trade, kurs);
    samaDengan(u.length, 0);
  });

  uji("hasil ditentukan uang bersih, bukan perbandingan harga", () => {
    // Harga naik dari 100 ke 101, tapi fee dua arah 15 membuatnya rugi bersih.
    const rugiTipis = bangunTrade(
      [
        tx({ ticker: "MSFT", qty: 10, harga: 100, fee: 15, tanggal: "2026-01-01" }),
        tx({ ticker: "MSFT", qty: 10, harga: 101, fee: 15, sisi: "jual", tanggal: "2026-01-20" }),
      ],
      kurs,
      KINI,
    );
    const u = usulkanPenutupan(
      [entri({ ticker: "MSFT", hargaEntry: 100, tanggal: "2026-01-01" })],
      rugiTipis,
      kurs,
    );
    samaDengan(u.length, 1);
    samaDengan(u[0].hasil, "rugi");
  });

  uji("mata uang entri dihormati saat mengusulkan harga keluar", () => {
    const u = usulkanPenutupan(
      [entri({ mataUang: "IDR", hargaEntry: 1_600_000, tanggal: "2026-01-01" })],
      trade,
      kurs,
    );
    mendekati(u[0].hargaKeluar, 130 * 16_000);
  });
});
