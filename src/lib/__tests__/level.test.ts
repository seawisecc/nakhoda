import {
  fibonacci, konversiOhlc, levelTerdekat, pivotKlasik, posisiDalamRentang, susunLevel,
} from "@/lib/hitung/level";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

// Angka NVDA 7 Sep 2026 dari Finnhub: o 231,09 h 234,76 l 229,63 c 230,36.
const nvda = { buka: 231.09, tinggi: 234.76, rendah: 229.63, tutup: 230.36 };

grup("pivot klasik", () => {
  uji("pivot adalah rata-rata tinggi, rendah, dan tutup", () => {
    const p = pivotKlasik(nvda).find((x) => x.nama === "Pivot")!;
    mendekati(p.harga, (234.76 + 229.63 + 230.36) / 3, 1e-6);
  });

  uji("R1 berjarak (pivot - rendah), S1 berjarak (tinggi - pivot)", () => {
    // R1 dan S1 sengaja TIDAK simetris terhadap pivot: masing-masing
    // dipantulkan dari sisi rentang yang berlawanan. Itu memang bentuk
    // rumus klasiknya, bukan kekeliruan.
    const l = pivotKlasik(nvda);
    const p = l.find((x) => x.nama === "Pivot")!.harga;
    const r1 = l.find((x) => x.nama === "R1")!.harga;
    const s1 = l.find((x) => x.nama === "S1")!.harga;
    mendekati(r1 - p, p - 229.63, 1e-6);
    mendekati(p - s1, 234.76 - p, 1e-6);
    benar(r1 > p && s1 < p, "R1 harus di atas pivot, S1 di bawah");
  });

  uji("tujuh level, urut dari R3 ke S3", () => {
    const l = pivotKlasik(nvda);
    samaDengan(l.length, 7);
    for (let i = 1; i < l.length; i += 1) benar(l[i].harga < l[i - 1].harga, "harus menurun");
  });

  uji("tinggi lebih rendah dari rendah ditolak, bukan dihitung", () =>
    samaDengan(pivotKlasik({ ...nvda, tinggi: 100, rendah: 200 }).length, 0));

  uji("angka nol ditolak", () =>
    samaDengan(pivotKlasik({ buka: 0, tinggi: 0, rendah: 0, tutup: 0 }).length, 0));
});

grup("fibonacci", () => {
  uji("sesi naik: 0% di tinggi, 100% di rendah", () => {
    // nvda sendiri sesi TURUN (tutup 230,36 di bawah buka 231,09), jadi
    // untuk kasus naik bukanya yang diturunkan.
    const f = fibonacci({ ...nvda, buka: 229.8 });
    mendekati(f[0].harga, 234.76, 1e-6);
    mendekati(f[f.length - 1].harga, 229.63, 1e-6);
  });

  uji("sesi turun membalik arahnya", () => {
    const f = fibonacci(nvda);
    mendekati(f[0].harga, 229.63, 1e-6);
    mendekati(f[f.length - 1].harga, 234.76, 1e-6);
  });

  uji("level 50% selalu di tengah rentang", () => {
    const f = fibonacci(nvda).find((x) => x.nama === "Fib 50%")!;
    mendekati(f.harga, (234.76 + 229.63) / 2, 1e-6);
  });

  uji("rentang nol tidak menghasilkan level", () =>
    samaDengan(fibonacci({ buka: 100, tinggi: 100, rendah: 100, tutup: 100 }).length, 0));
});

grup("susunLevel", () => {
  uji("level milikmu ikut masuk dan ditandai", () => {
    const l = susunLevel(nvda, 230.36, { avgHarga: 221.76, stopLoss: 212, targetHarga: 275 });
    const milik = l.filter((x) => x.kelompok === "milikmu");
    samaDengan(milik.length, 3);
    benar(l.some((x) => x.nama === "Targetmu" && x.harga === 275));
  });

  uji("jarak persen dihitung dari harga sekarang", () => {
    const l = susunLevel(null, 100, { targetHarga: 110, stopLoss: 90 });
    mendekati(l.find((x) => x.nama === "Targetmu")!.jarakPersen, 10, 1e-6);
    mendekati(l.find((x) => x.nama === "Stopmu")!.jarakPersen, -10, 1e-6);
  });

  uji("diurutkan dari harga tertinggi ke terendah", () => {
    const l = susunLevel(nvda, 230.36, { avgHarga: 221.76 });
    for (let i = 1; i < l.length; i += 1) benar(l[i].harga <= l[i - 1].harga);
  });

  uji("tanpa OHLC tetap menghasilkan level milikmu saja", () => {
    const l = susunLevel(null, 230, { avgHarga: 221.76 });
    samaDengan(l.length, 1);
  });

  uji("level nol atau negatif dibuang", () => {
    const l = susunLevel(null, 100, { avgHarga: 0, stopLoss: -5, targetHarga: 110 });
    samaDengan(l.length, 1);
  });
});

grup("levelTerdekat", () => {
  uji("mengambil satu di atas dan satu di bawah harga sekarang", () => {
    const l = susunLevel(nvda, 230.36, {});
    const { atas, bawah } = levelTerdekat(l, 230.36);
    benar(atas !== null && atas.harga > 230.36, "atas harus di atas harga");
    benar(bawah !== null && bawah.harga < 230.36, "bawah harus di bawah harga");
  });

  uji("harga di luar semua level mengembalikan null di satu sisi", () => {
    const l = susunLevel(null, 100, { targetHarga: 110 });
    samaDengan(levelTerdekat(l, 999).atas, null);
  });
});

grup("posisiDalamRentang", () => {
  uji("tepat di tengah rentang bernilai setengah", () =>
    mendekati(posisiDalamRentang(nvda, (234.76 + 229.63) / 2)!, 0.5, 1e-6));
  uji("di puncak bernilai satu", () => mendekati(posisiDalamRentang(nvda, 234.76)!, 1, 1e-6));
  uji("di luar rentang tetap dijepit ke 0 sampai 1", () => {
    samaDengan(posisiDalamRentang(nvda, 999), 1);
    samaDengan(posisiDalamRentang(nvda, 1), 0);
  });
  uji("rentang nol mengembalikan null", () =>
    samaDengan(posisiDalamRentang({ buka: 5, tinggi: 5, rendah: 5, tutup: 5 }, 5), null));
});

grup("konversiOhlc", () => {
  const kurs = { usdIdr: 17_674 };
  const btc = { buka: 79_915.26, tinggi: 80_494, rendah: 79_426, tutup: 80_100, tutupSebelumnya: 79_915.26 };

  uji("USD ke IDR mengalikan seluruh ujung harga", () => {
    const h = konversiOhlc(btc, "IDR", kurs);
    mendekati(h.tinggi, 80_494 * 17_674, 1e-6);
    mendekati(h.rendah, 79_426 * 17_674, 1e-6);
    mendekati(h.tutup, 80_100 * 17_674, 1e-6);
    mendekati(h.tutupSebelumnya!, 79_915.26 * 17_674, 1e-6);
  });

  uji("USD ke USD tidak mengubah apa pun", () => {
    samaDengan(konversiOhlc(btc, "USD", kurs), btc);
  });

  uji("tutupSebelumnya yang kosong tetap kosong, bukan jadi nol", () => {
    const h = konversiOhlc({ ...btc, tutupSebelumnya: undefined }, "IDR", kurs);
    samaDengan(h.tutupSebelumnya, undefined);
  });

  uji("level dari OHLC terkonversi sepadan dengan level milikmu", () => {
    // Inti bugnya: rata-rata beli BTC ada dalam rupiah (miliaran), sedangkan
    // OHLC datang dalam dolar (puluhan ribu). Setelah konversi, keduanya harus
    // berada dalam orde besaran yang sama supaya daftar levelnya bermakna.
    const h = konversiOhlc(btc, "IDR", kurs);
    const l = susunLevel(h, h.tutup, { avgHarga: 1_510_162_854 });
    const pivot = l.find((x) => x.nama === "Pivot")!;
    benar(pivot.harga > 1e9 && pivot.harga < 2e9, "pivot harus dalam orde miliar rupiah");
    benar(Math.abs(pivot.jarakPersen) < 50, "jaraknya harus wajar, bukan ribuan persen");
  });
});
