import {
  modifiedDietz,
  nilaiBukuPada,
  realisasiPeriode,
  realisasiTiapJual,
  returnBulanBerjalan,
  ringkasPortofolio,
  rMultiple,
  rrRencana,
  statistikJurnal,
} from "@/lib/hitung/kinerja";
import { bangunPosisi, nilaiPosisi } from "@/lib/hitung/posisi";
import type { ArusModal, JurnalEntri, Transaksi } from "@/types";
import { grup, uji, mendekati, samaDengan, benar } from "./uji";

const kurs = { usdIdr: 16_000 };
let n = 0;

function tx(p: Partial<Transaksi>): Transaksi {
  return {
    id: `t${++n}`, uid: "u", ticker: "NVDA", jenisAset: "saham", sisi: "beli",
    tanggal: "2026-09-01", qty: 1, harga: 100, fee: 0, mataUang: "IDR",
    dibuatPada: n, ...p,
  };
}
function arus(p: Partial<ArusModal>): ArusModal {
  return {
    id: `a${++n}`, uid: "u", tanggal: "2026-09-01", jumlah: 1000,
    mataUang: "IDR", tipe: "setor", dibuatPada: n, ...p,
  };
}
function jrn(p: Partial<JurnalEntri>): JurnalEntri {
  return {
    id: `j${++n}`, uid: "u", ticker: "NVDA", jenisAset: "saham",
    tanggal: "2026-09-01", mataUang: "USD", thesisTeknikal: "", thesisFundamental: "",
    hargaEntry: 100, stopLoss: 90, targetHarga: 130, status: "terbuka",
    dibuatPada: n, ...p,
  };
}

grup("modifiedDietz", () => {
  uji("tanpa arus modal, hasilnya sama dengan return sederhana", () => {
    const h = modifiedDietz({
      bmv: 1000, emv: 1100, arus: [], mulai: "2026-09-01", akhir: "2026-09-30",
    });
    mendekati(h.persen!, 10);
  });

  uji("setoran di hari terakhir tidak dihitung sebagai kenaikan", () => {
    // Portofolio 1000 jadi 2000, tapi 1000 di antaranya adalah uang baru yang
    // masuk di hari terakhir. Return sebenarnya nol, bukan +100%.
    const h = modifiedDietz({
      bmv: 1000, emv: 2000,
      arus: [{ tanggal: "2026-09-30", jumlah: 1000 }],
      mulai: "2026-09-01", akhir: "2026-09-30",
    });
    mendekati(h.persen!, 0);
    // Rumus naif akan menjawab 100. Ini justru inti kenapa Dietz dipakai.
    mendekati(((2000 - 1000) / 1000) * 100, 100);
  });

  uji("setoran di tengah periode dapat bobot separuh", () => {
    // T = 30 hari, setoran di hari ke-15 bekerja separuh periode.
    // Penyebut = 1000 + 1000 × (1 − 15/30) = 1500. Pembilang = 2100−1000−1000 = 100.
    const h = modifiedDietz({
      bmv: 1000, emv: 2100,
      arus: [{ tanggal: "2026-09-16", jumlah: 1000 }],
      mulai: "2026-09-01", akhir: "2026-10-01",
    });
    mendekati(h.modalRata, 1500);
    mendekati(h.persen!, (100 / 1500) * 100);
  });

  uji("penarikan bertanda negatif dan menurunkan penyebut", () => {
    const h = modifiedDietz({
      bmv: 2000, emv: 1050,
      arus: [{ tanggal: "2026-09-01", jumlah: -1000 }],
      mulai: "2026-09-01", akhir: "2026-09-30",
    });
    // Arus tepat di tanggal mulai tidak masuk periode; dia sudah tercermin di BMV.
    mendekati(h.arusBersih, 0);
    mendekati(h.persen!, -47.5);
  });

  uji("arus tepat di tanggal awal periode tidak dihitung dua kali", () => {
    const h = modifiedDietz({
      bmv: 1000, emv: 1100,
      arus: [{ tanggal: "2026-09-01", jumlah: 500 }],
      mulai: "2026-09-01", akhir: "2026-09-30",
    });
    mendekati(h.arusBersih, 0);
    mendekati(h.persen!, 10);
  });

  uji("periode nol hari mengembalikan null, bukan pembagian nol", () => {
    const h = modifiedDietz({
      bmv: 1000, emv: 1000, arus: [], mulai: "2026-09-01", akhir: "2026-09-01",
    });
    samaDengan(h.persen, null);
    benar(!!h.alasanKosong, "harus menjelaskan kenapa kosong");
  });

  uji("modal rata-rata nol mengembalikan null", () => {
    const h = modifiedDietz({
      bmv: 0, emv: 100, arus: [], mulai: "2026-09-01", akhir: "2026-09-30",
    });
    samaDengan(h.persen, null);
  });

  uji("portofolio yang dimulai dari nol dengan setoran hari pertama", () => {
    // BMV 0, setor 1000 di hari ke-1, akhir 1100. Penyebut = 1000 × (1−1/30).
    const h = modifiedDietz({
      bmv: 0, emv: 1100,
      arus: [{ tanggal: "2026-09-02", jumlah: 1000 }],
      mulai: "2026-09-01", akhir: "2026-10-01",
    });
    mendekati(h.modalRata, 1000 * (1 - 1 / 30));
    mendekati(h.persen!, (100 / (1000 * (1 - 1 / 30))) * 100);
  });
});

grup("nilaiBukuPada", () => {
  uji("sebelum ada transaksi, nilai buku sama dengan modal yang sudah masuk", () => {
    const v = nilaiBukuPada([], [arus({ jumlah: 5000, tanggal: "2026-08-01" })],
      "2026-09-01", "IDR", kurs);
    mendekati(v, 5000);
  });

  uji("membeli aset tidak mengubah nilai buku, hanya memindahkannya", () => {
    const v = nilaiBukuPada(
      [tx({ qty: 10, harga: 100, tanggal: "2026-08-10" })],
      [arus({ jumlah: 5000, tanggal: "2026-08-01" })],
      "2026-09-01", "IDR", kurs,
    );
    mendekati(v, 5000);
  });

  uji("laba terealisasi menaikkan nilai buku", () => {
    const v = nilaiBukuPada(
      [
        tx({ qty: 10, harga: 100, tanggal: "2026-08-10" }),
        tx({ qty: 10, harga: 120, sisi: "jual", tanggal: "2026-08-20" }),
      ],
      [arus({ jumlah: 5000, tanggal: "2026-08-01" })],
      "2026-09-01", "IDR", kurs,
    );
    mendekati(v, 5200);
  });

  uji("transaksi setelah tanggal batas diabaikan", () => {
    const v = nilaiBukuPada(
      [tx({ qty: 10, harga: 100, sisi: "jual", tanggal: "2026-09-20" })],
      [arus({ jumlah: 5000, tanggal: "2026-08-01" })],
      "2026-09-01", "IDR", kurs,
    );
    mendekati(v, 5000);
  });
});

grup("ringkasPortofolio", () => {
  const transaksi = [
    tx({ ticker: "NVDA", qty: 10, harga: 100, tanggal: "2026-09-02" }),
    tx({ ticker: "BTC", jenisAset: "kripto", qty: 1, harga: 2000, tanggal: "2026-09-03" }),
  ];
  const modal = [arus({ jumlah: 10_000, tipe: "awal", tanggal: "2026-09-01" })];
  const posisi = nilaiPosisi(bangunPosisi(transaksi, kurs), {
    NVDA: { harga: 130, mataUang: "IDR", diperbaruiPada: 1 },
    BTC: { harga: 2400, mataUang: "IDR", diperbaruiPada: 1 },
  }, kurs);

  uji("kas adalah modal dikurangi belanja", () => {
    const r = ringkasPortofolio(posisi, transaksi, modal, "IDR", kurs);
    mendekati(r.kas, 10_000 - 1000 - 2000);
  });

  uji("total nilai adalah kas ditambah nilai pasar posisi", () => {
    const r = ringkasPortofolio(posisi, transaksi, modal, "IDR", kurs);
    mendekati(r.nilaiPosisi, 1300 + 2400);
    mendekati(r.totalNilai, 7000 + 3700);
  });

  uji("laba total adalah total nilai dikurangi modal bersih", () => {
    const r = ringkasPortofolio(posisi, transaksi, modal, "IDR", kurs);
    mendekati(r.labaTotal, 700);
    mendekati(r.labaTotalPersen, 7);
  });

  uji("penarikan mengurangi modal bersih dan kas", () => {
    const dgnTarik = [...modal, arus({ jumlah: 1000, tipe: "tarik", tanggal: "2026-09-10" })];
    const r = ringkasPortofolio(posisi, transaksi, dgnTarik, "IDR", kurs);
    mendekati(r.modalBersih, 9000);
    mendekati(r.kas, 6000);
    mendekati(r.labaTotal, 700);
  });

  uji("alokasi dipecah per kelas aset", () => {
    const r = ringkasPortofolio(posisi, transaksi, modal, "IDR", kurs);
    mendekati(r.alokasi.saham, 1300);
    mendekati(r.alokasi.kripto, 2400);
    mendekati(r.alokasi.kas, 7000);
  });

  uji("posisi tanpa harga dinilai sebesar modalnya dan dihitung", () => {
    const tanpaHarga = nilaiPosisi(bangunPosisi(transaksi, kurs), {
      NVDA: { harga: 130, mataUang: "IDR", diperbaruiPada: 1 },
    }, kurs);
    const r = ringkasPortofolio(tanpaHarga, transaksi, modal, "IDR", kurs);
    samaDengan(r.posisiTanpaHarga, 1);
    mendekati(r.nilaiPosisi, 1300 + 2000);
  });

  uji("mata uang dasar USD mengonversi seluruh angka", () => {
    const r = ringkasPortofolio(posisi, transaksi, modal, "USD", kurs);
    mendekati(r.totalNilai, 10_700 / 16_000);
  });
});

grup("returnBulanBerjalan", () => {
  const modal = [arus({ jumlah: 10_000, tipe: "awal", tanggal: "2026-08-01" })];

  uji("memakai snapshot sebagai BMV kalau tersedia", () => {
    const h = returnBulanBerjalan({
      totalNilai: 11_000, transaksi: [], arus: modal,
      snapshot: [{
        id: "s", uid: "u", tanggal: "2026-09-01", nilaiTotal: 10_000,
        mataUang: "IDR", dibuatPada: 1,
      }],
      dasar: "IDR", kurs, tanggal: "2026-09-20",
    });
    samaDengan(h.bmvPerkiraan, false);
    mendekati(h.persen!, 10);
  });

  uji("tanpa snapshot, jatuh ke nilai buku dan ditandai perkiraan", () => {
    const h = returnBulanBerjalan({
      totalNilai: 11_000, transaksi: [], arus: modal, snapshot: [],
      dasar: "IDR", kurs, tanggal: "2026-09-20",
    });
    samaDengan(h.bmvPerkiraan, true);
    mendekati(h.bmv, 10_000);
  });

  uji("snapshot yang lebih tua dari sebulan tidak dipakai", () => {
    const h = returnBulanBerjalan({
      totalNilai: 11_000, transaksi: [], arus: modal,
      snapshot: [{
        id: "s", uid: "u", tanggal: "2026-06-15", nilaiTotal: 4000,
        mataUang: "IDR", dibuatPada: 1,
      }],
      dasar: "IDR", kurs, tanggal: "2026-09-20",
    });
    samaDengan(h.bmvPerkiraan, true);
  });

  uji("setoran bulan berjalan tidak terbaca sebagai keuntungan", () => {
    const h = returnBulanBerjalan({
      totalNilai: 20_000, transaksi: [],
      arus: [...modal, arus({ jumlah: 10_000, tipe: "setor", tanggal: "2026-09-20" })],
      snapshot: [{
        id: "s", uid: "u", tanggal: "2026-09-01", nilaiTotal: 10_000,
        mataUang: "IDR", dibuatPada: 1,
      }],
      dasar: "IDR", kurs, tanggal: "2026-09-20",
    });
    mendekati(h.persen!, 0);
  });
});

grup("statistikJurnal", () => {
  uji("win rate dari trade yang sudah ditutup", () => {
    const s = statistikJurnal([
      jrn({ status: "tertutup", hasil: "untung", hargaKeluar: 130 }),
      jrn({ status: "tertutup", hasil: "rugi", hargaKeluar: 90 }),
      jrn({ status: "tertutup", hasil: "untung", hargaKeluar: 120 }),
      jrn({ status: "terbuka" }),
    ]);
    samaDengan(s.totalTertutup, 3);
    mendekati(s.winRate!, (2 / 3) * 100);
    samaDengan(s.terbuka, 1);
  });

  uji("belum ada trade tertutup mengembalikan null, bukan nol persen", () => {
    const s = statistikJurnal([jrn({ status: "terbuka" })]);
    samaDengan(s.winRate, null);
    samaDengan(s.ekspektansiR, null);
  });

  uji("R-multiple mengukur hasil dalam kelipatan risiko awal", () => {
    // Entry 100, stop 90, risiko 10. Keluar di 130 berarti +3R.
    mendekati(rMultiple(jrn({ hargaKeluar: 130 }))!, 3);
    mendekati(rMultiple(jrn({ hargaKeluar: 90 }))!, -1);
    mendekati(rMultiple(jrn({ hargaKeluar: 105 }))!, 0.5);
  });

  uji("R-multiple posisi short dibalik arahnya", () => {
    const e = jrn({ hargaEntry: 100, stopLoss: 110, targetHarga: 80, hargaKeluar: 80 });
    mendekati(rMultiple(e)!, 2);
  });

  uji("ekspektansi adalah rata-rata R dari semua trade tertutup", () => {
    const s = statistikJurnal([
      jrn({ status: "tertutup", hasil: "untung", hargaKeluar: 130 }),
      jrn({ status: "tertutup", hasil: "rugi", hargaKeluar: 90 }),
    ]);
    mendekati(s.ekspektansiR!, 1);
    mendekati(s.rataMenangR!, 3);
    mendekati(s.rataKalahR!, -1);
  });

  uji("rrRencana null kalau stop sama dengan entry", () => {
    samaDengan(rrRencana({ hargaEntry: 100, stopLoss: 100, targetHarga: 120 }), null);
  });
});

grup("realisasiTiapJual", () => {
  uji("satu baris per penjualan, memakai biaya rata-rata", () => {
    const r = realisasiTiapJual([
      tx({ qty: 10, harga: 100, tanggal: "2026-09-01" }),
      tx({ qty: 10, harga: 200, tanggal: "2026-09-05" }),
      tx({ qty: 5, harga: 250, sisi: "jual", tanggal: "2026-09-10" }),
      tx({ qty: 5, harga: 300, sisi: "jual", tanggal: "2026-10-02" }),
    ], "IDR", kurs);
    samaDengan(r.length, 2);
    mendekati(r[0].jumlah, 500);
    mendekati(r[1].jumlah, 750);
    samaDengan(r[1].tanggal, "2026-10-02");
  });

  uji("pembelian saja tidak menghasilkan baris realisasi", () => {
    samaDengan(realisasiTiapJual([tx({ qty: 10, harga: 100 })], "IDR", kurs).length, 0);
  });
});

grup("realisasiPeriode", () => {
  const transaksi = [
    tx({ qty: 10, harga: 100, tanggal: "2026-08-20" }),
    // Untung 500 di dalam periode.
    tx({ qty: 5, harga: 200, sisi: "jual", tanggal: "2026-09-10" }),
    // Untung 500 lagi, tapi di luar periode.
    tx({ qty: 5, harga: 200, sisi: "jual", tanggal: "2026-10-05" }),
  ];
  const modal = [arus({ tanggal: "2026-08-01", jumlah: 10_000, tipe: "awal" })];

  const opsi = {
    transaksi, arus: modal, mulai: "2026-09-01", akhir: "2026-09-30",
    targetMinPersen: 3, targetMaksPersen: 10, dasar: "IDR" as const, kurs,
  };

  uji("hanya menghitung penjualan di dalam periode", () => {
    const r = realisasiPeriode(opsi);
    mendekati(r.realisasi, 500);
    samaDengan(r.jumlahJual, 1);
  });

  uji("persen diukur terhadap modal bersih, bukan nilai portofolio", () => {
    const r = realisasiPeriode(opsi);
    mendekati(r.modal, 10_000);
    mendekati(r.persen!, 5);
    samaDengan(r.status, "tercapai");
  });

  uji("target persen diterjemahkan ke rupiah", () => {
    const r = realisasiPeriode(opsi);
    mendekati(r.targetMin, 300);
    mendekati(r.targetMax, 1000);
  });

  uji("di bawah target minimum berstatus belum", () => {
    const r = realisasiPeriode({ ...opsi, targetMinPersen: 8, targetMaksPersen: 12 });
    samaDengan(r.status, "belum");
  });

  uji("di atas target maksimum berstatus lampaui", () => {
    const r = realisasiPeriode({ ...opsi, targetMinPersen: 1, targetMaksPersen: 4 });
    samaDengan(r.status, "lampaui");
  });

  uji("realisasi negatif berstatus rugi, bukan belum", () => {
    const r = realisasiPeriode({
      ...opsi,
      transaksi: [
        tx({ qty: 10, harga: 100, tanggal: "2026-08-20" }),
        tx({ qty: 10, harga: 80, sisi: "jual", tanggal: "2026-09-10" }),
      ],
    });
    mendekati(r.realisasi, -200);
    samaDengan(r.status, "rugi");
  });

  uji("tanpa modal tercatat, persennya null dan bukan nol", () => {
    const r = realisasiPeriode({ ...opsi, arus: [] });
    samaDengan(r.persen, null);
    samaDengan(r.status, "kosong");
  });

  uji("setoran di tengah periode ikut menaikkan penyebut", () => {
    const r = realisasiPeriode({
      ...opsi,
      arus: [...modal, arus({ tanggal: "2026-09-15", jumlah: 10_000, tipe: "setor" })],
    });
    mendekati(r.modal, 20_000);
    mendekati(r.persen!, 2.5);
  });
});
