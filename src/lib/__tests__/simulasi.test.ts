import { returnBulananTersirat, simulasiTarget } from "@/lib/hitung/simulasi";
import { hariAntara, tambahBulan } from "@/lib/tanggal";
import { grup, uji, mendekati, samaDengan, benar } from "./uji";

grup("simulasiTarget", () => {
  uji("tanpa return, target tercapai murni dari setoran", () => {
    const h = simulasiTarget({ awal: 0, target: 1000, returnPersen: 0, setoran: 100 });
    samaDengan(h.bulan, 10);
    mendekati(h.totalReturn, 0);
    mendekati(h.totalSetor, 1000);
  });

  uji("tanpa setoran, bunga majemuk murni", () => {
    // 1,1^7 = 1,95 dan 1,1^8 = 2,14: dua kali lipat terlewati di bulan ke-8.
    const h = simulasiTarget({ awal: 100, target: 200, returnPersen: 10, setoran: 0 });
    samaDengan(h.bulan, 8);
    mendekati(h.nilaiAkhir, 100 * 1.1 ** 8);
  });

  uji("setoran tidak ikut berbunga di bulan dia masuk", () => {
    // Bulan 1: 0 × 1,1 + 100 = 100, bukan 110. Kalau urutannya terbalik,
    // target 105 sudah tembus di bulan pertama.
    const h = simulasiTarget({ awal: 0, target: 105, returnPersen: 10, setoran: 100 });
    samaDengan(h.bulan, 2);
    mendekati(h.nilaiAkhir, 210);
  });

  uji("return dan setoran dipisah di hasil akhir", () => {
    const h = simulasiTarget({ awal: 1000, target: 5000, returnPersen: 2, setoran: 100 });
    mendekati(h.totalSetor + h.totalReturn, h.nilaiAkhir);
    mendekati(h.totalSetor, 1000 + 100 * h.bulan!);
  });

  uji("yang sudah melewati target menjawab nol bulan", () => {
    const h = simulasiTarget({ awal: 2000, target: 1000, returnPersen: 3, setoran: 0 });
    samaDengan(h.bulan, 0);
    samaDengan(h.alasan, "sudah");
  });

  uji("tanpa return dan tanpa setoran tidak pernah tercapai", () => {
    const h = simulasiTarget({ awal: 100, target: 1000, returnPersen: 0, setoran: 0 });
    samaDengan(h.bulan, null);
    samaDengan(h.alasan, "tidak-pernah");
  });

  uji("return negatif berhenti di titik keseimbangan, bukan lewat batas", () => {
    // Setoran 100 dengan rugi 1% per bulan tertahan di sekitar 10.000.
    const h = simulasiTarget({ awal: 0, target: 20_000, returnPersen: -1, setoran: 100 });
    samaDengan(h.alasan, "tidak-pernah");
  });

  uji("return negatif tetap bisa tembus kalau keseimbangannya di atas target", () => {
    const h = simulasiTarget({ awal: 0, target: 5000, returnPersen: -1, setoran: 100 });
    samaDengan(h.alasan, "tercapai");
  });

  uji("yang terlalu lama dilaporkan lewat batas", () => {
    const h = simulasiTarget({ awal: 0, target: 1e9, returnPersen: 0, setoran: 1, batasBulan: 12 });
    samaDengan(h.bulan, null);
    samaDengan(h.alasan, "lewat-batas");
  });

  uji("tonggak urut dan hanya yang di atas nilai awal", () => {
    const h = simulasiTarget({ awal: 8_000_000, target: 1e9, returnPersen: 3, setoran: 500_000 });
    samaDengan(h.tonggak[0].nilai, 10_000_000);
    samaDengan(h.tonggak[h.tonggak.length - 1].nilai, 1e9);
    benar(h.tonggak.every((t, i) => i === 0 || t.bulan >= h.tonggak[i - 1].bulan), "bulan tonggak mundur");
    samaDengan(h.tonggak[h.tonggak.length - 1].bulan, h.bulan);
  });

  uji("porsi setoran turun seiring bunga majemuk bekerja", () => {
    const h = simulasiTarget({ awal: 8_000_000, target: 1e9, returnPersen: 3, setoran: 500_000 });
    benar(h.tonggak[h.tonggak.length - 1].porsiSetoran < h.tonggak[0].porsiSetoran);
  });
});

grup("returnBulananTersirat", () => {
  uji("satu setoran yang tumbuh 1% sebulan terbaca 1%", () => {
    const hari = hariAntara("2025-09-21", "2026-09-21");
    const nilai = 1000 * 1.01 ** (hari / (365.25 / 12));
    mendekati(returnBulananTersirat([{ tanggal: "2025-09-21", jumlah: 1000 }], nilai, "2026-09-21")!, 1, 1e-6);
  });

  uji("setoran belakangan tidak dianggap sudah bekerja sejak awal", () => {
    // 1000 sejak setahun lalu plus 1000 kemarin, nilai 2100. Laba 100 dibagi
    // modal 2000 selama 12 bulan akan menjawab ~0,42%; yang benar ~0,8%,
    // karena setoran kemarin belum sempat menghasilkan apa pun.
    const r = returnBulananTersirat(
      [{ tanggal: "2025-09-21", jumlah: 1000 }, { tanggal: "2026-09-20", jumlah: 1000 }],
      2100, "2026-09-21",
    )!;
    benar(r > 0.75 && r < 0.85, `dapat ${r}`);
  });

  uji("riwayat kurang dari sebulan tidak menghasilkan angka", () => {
    samaDengan(returnBulananTersirat([{ tanggal: "2026-09-10", jumlah: 1000 }], 1100, "2026-09-21"), null);
  });

  uji("tanpa arus tidak menghasilkan angka", () => {
    samaDengan(returnBulananTersirat([], 1000, "2026-09-21"), null);
  });

  uji("rugi terbaca negatif", () => {
    const r = returnBulananTersirat([{ tanggal: "2025-09-21", jumlah: 1000 }], 900, "2026-09-21")!;
    benar(r < 0, `dapat ${r}`);
  });
});

grup("tambahBulan", () => {
  uji("melewati pergantian tahun", () => {
    samaDengan(tambahBulan("2026-09", 18), "2028-03");
    samaDengan(tambahBulan("2026-12", 1), "2027-01");
    samaDengan(tambahBulan("2026-09", 0), "2026-09");
  });
});
