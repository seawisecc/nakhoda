import {
  bersihDividen,
  dividenPerTicker,
  dividenPeriode,
  dividenSampai,
  dividenTerlewat,
  hasilAtasBiaya,
} from "@/lib/hitung/dividen";
import { bangunPosisi } from "@/lib/hitung/posisi";
import type { Dividen, Transaksi } from "@/types";
import { grup, uji, mendekati, samaDengan } from "./uji";

const kurs = { usdIdr: 16_000 };
let n = 0;

function div(p: Partial<Dividen>): Dividen {
  return {
    id: `d${++n}`, uid: "u", ticker: "NVDA", jenisAset: "saham",
    tanggal: "2026-09-01", jumlahKotor: 100, pajak: 0, mataUang: "IDR",
    dibuatPada: n, ...p,
  };
}
function tx(p: Partial<Transaksi>): Transaksi {
  return {
    id: `t${++n}`, uid: "u", ticker: "NVDA", jenisAset: "saham", sisi: "beli",
    tanggal: "2026-01-05", qty: 1, harga: 100, fee: 0, mataUang: "IDR",
    dibuatPada: n, ...p,
  };
}

grup("bersihDividen", () => {
  uji("pajak dipotong dari jumlah kotor", () => {
    mendekati(bersihDividen({ jumlahKotor: 100, pajak: 10 }), 90);
  });

  uji("pajak nol berarti bersih sama dengan kotor", () => {
    mendekati(bersihDividen({ jumlahKotor: 100, pajak: 0 }), 100);
  });

  uji("angka rusak diperlakukan nol, bukan NaN", () => {
    // Satu NaN di sini akan menjalar ke kas, lalu ke total portofolio, dan
    // seluruh dasbor tampil kosong tanpa satu pun pesan galat.
    mendekati(bersihDividen({ jumlahKotor: Number.NaN, pajak: 10 }), -10);
    mendekati(bersihDividen({ jumlahKotor: 100, pajak: Number.NaN }), 100);
  });
});

grup("dividenSampai", () => {
  const daftar = [
    div({ tanggal: "2026-08-10", jumlahKotor: 100, pajak: 10 }),
    div({ tanggal: "2026-09-10", jumlahKotor: 200, pajak: 20 }),
  ];

  uji("menjumlahkan yang bersih, bukan yang kotor", () => {
    mendekati(dividenSampai(daftar, null, "IDR", kurs), 270);
  });

  uji("batas tanggal inklusif dan yang sesudahnya diabaikan", () => {
    mendekati(dividenSampai(daftar, "2026-08-10", "IDR", kurs), 90);
    mendekati(dividenSampai(daftar, "2026-09-09", "IDR", kurs), 90);
  });

  uji("dividen dolar dikonversi ke mata uang dasar", () => {
    const usd = [div({ mataUang: "USD", jumlahKotor: 1, pajak: 0.1 })];
    mendekati(dividenSampai(usd, null, "IDR", kurs), 0.9 * 16_000);
    // Bug termahal di proyek ini adalah harga dolar berlabel rupiah. Dividen
    // MSFT $0,17 yang masuk sebagai Rp 0,17 akan hilang tanpa jejak.
    mendekati(dividenSampai(usd, null, "USD", kurs), 0.9);
  });
});

grup("dividenPeriode", () => {
  const daftar = [
    div({ tanggal: "2026-08-31", jumlahKotor: 50 }),
    div({ tanggal: "2026-09-01", jumlahKotor: 100 }),
    div({ tanggal: "2026-09-30", jumlahKotor: 200 }),
    div({ tanggal: "2026-10-01", jumlahKotor: 400 }),
  ];

  uji("kedua ujung periode ikut terhitung", () => {
    const r = dividenPeriode(daftar, "2026-09-01", "2026-09-30", "IDR", kurs);
    mendekati(r.jumlah, 300);
    samaDengan(r.banyak, 2);
  });

  uji("di luar periode tidak ikut", () => {
    const r = dividenPeriode(daftar, "2026-09-02", "2026-09-29", "IDR", kurs);
    mendekati(r.jumlah, 0);
    samaDengan(r.banyak, 0);
  });
});

grup("dividenPerTicker", () => {
  const daftar = [
    div({ ticker: "KMI", tanggal: "2026-03-15", jumlahKotor: 300, pajak: 30 }),
    div({ ticker: "KMI", tanggal: "2026-06-15", jumlahKotor: 300, pajak: 30 }),
    div({ ticker: "NVDA", tanggal: "2026-09-11", jumlahKotor: 100, pajak: 10 }),
    // Lebih tua dari 12 bulan terhadap acuan di bawah.
    div({ ticker: "NVDA", tanggal: "2025-01-10", jumlahKotor: 1000, pajak: 0 }),
  ];

  uji("dikelompokkan per ticker dan diurut dari yang terbesar", () => {
    const r = dividenPerTicker(daftar, "IDR", kurs, "2026-09-21");
    samaDengan(r.map((x) => x.ticker), ["NVDA", "KMI"]);
    mendekati(r[1].bersih, 540);
    samaDengan(r[1].banyak, 2);
  });

  uji("kotor dan pajak dilaporkan terpisah dari bersih", () => {
    const r = dividenPerTicker(daftar, "IDR", kurs, "2026-09-21");
    const kmi = r.find((x) => x.ticker === "KMI")!;
    mendekati(kmi.kotor, 600);
    mendekati(kmi.pajak, 60);
    mendekati(kmi.bersih, 540);
  });

  uji("jendela 12 bulan tidak memotong total riwayat", () => {
    const r = dividenPerTicker(daftar, "IDR", kurs, "2026-09-21");
    const nvda = r.find((x) => x.ticker === "NVDA")!;
    // Yang 2025 tetap ikut ke total, tapi tidak ke jendela 12 bulan.
    mendekati(nvda.bersih, 1090);
    mendekati(nvda.bersih12Bulan, 90);
  });

  uji("tanggal terakhir diambil yang paling baru", () => {
    const r = dividenPerTicker(daftar, "IDR", kurs, "2026-09-21");
    samaDengan(r.find((x) => x.ticker === "KMI")!.terakhir, "2026-06-15");
  });

  uji("ticker disamakan huruf besar-kecilnya", () => {
    const r = dividenPerTicker(
      [div({ ticker: "kmi", jumlahKotor: 100 }), div({ ticker: "KMI", jumlahKotor: 100 })],
      "IDR", kurs, "2026-09-21",
    );
    samaDengan(r.length, 1);
    mendekati(r[0].bersih, 200);
  });
});

grup("hasilAtasBiaya", () => {
  const posisi = bangunPosisi(
    [
      tx({ ticker: "KMI", qty: 10, harga: 100 }),
      tx({ ticker: "MSFT", qty: 10, harga: 100 }),
    ],
    kurs,
  );

  uji("persennya dihitung atas biaya perolehan, bukan harga pasar", () => {
    const r = hasilAtasBiaya(
      posisi, [div({ ticker: "KMI", tanggal: "2026-06-15", jumlahKotor: 60, pajak: 0 })],
      "IDR", kurs, "2026-09-21",
    );
    samaDengan(r.map((x) => x.ticker), ["KMI"]);
    mendekati(r[0].persen, 6);
  });

  uji("posisi tanpa dividen tercatat hilang dari daftar, bukan muncul 0%", () => {
    // Nol persen adalah klaim bahwa emitennya tidak membayar. Yang diketahui
    // datanya cuma bahwa belum ada yang dicatat, dan itu bukan hal yang sama.
    const r = hasilAtasBiaya(
      posisi, [div({ ticker: "KMI", tanggal: "2026-06-15", jumlahKotor: 60 })],
      "IDR", kurs, "2026-09-21",
    );
    samaDengan(r.some((x) => x.ticker === "MSFT"), false);
  });

  uji("dividen yang lebih tua dari 12 bulan tidak dipakai", () => {
    const r = hasilAtasBiaya(
      posisi, [div({ ticker: "KMI", tanggal: "2024-06-15", jumlahKotor: 60 })],
      "IDR", kurs, "2026-09-21",
    );
    samaDengan(r.length, 0);
  });

  uji("posisi yang sudah ditutup tidak ikut", () => {
    const tutup = bangunPosisi(
      [
        tx({ ticker: "KMI", qty: 10, harga: 100 }),
        tx({ ticker: "KMI", qty: 10, harga: 120, sisi: "jual", tanggal: "2026-07-01" }),
      ],
      kurs,
    );
    const r = hasilAtasBiaya(
      tutup, [div({ ticker: "KMI", tanggal: "2026-06-15", jumlahKotor: 60 })],
      "IDR", kurs, "2026-09-21",
    );
    samaDengan(r.length, 0);
  });
});

grup("dividenTerlewat", () => {
  const posisi = bangunPosisi([tx({ ticker: "KMI", qty: 10, harga: 100 })], kurs);

  uji("ticker yang sudah lama tidak ada catatannya ditandai", () => {
    const r = dividenTerlewat(
      posisi, [div({ ticker: "KMI", tanggal: "2026-03-15" })], "2026-09-21",
    );
    samaDengan(r.map((x) => x.ticker), ["KMI"]);
    samaDengan(r[0].selangHari, 190);
  });

  uji("yang baru dicatat tidak ditandai", () => {
    const r = dividenTerlewat(
      posisi, [div({ ticker: "KMI", tanggal: "2026-08-15" })], "2026-09-21",
    );
    samaDengan(r.length, 0);
  });

  uji("ticker yang belum pernah bayar dividen tidak ditandai", () => {
    // Tanpa satu pun catatan, tidak ada dasar untuk menyebut ini terlewat.
    // Menandainya berarti menuduh setiap saham non-dividen punya data hilang.
    samaDengan(dividenTerlewat(posisi, [], "2026-09-21").length, 0);
  });
});
