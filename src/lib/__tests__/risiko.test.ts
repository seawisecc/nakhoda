import { hitungRisiko, nilaiRR } from "@/lib/hitung/risiko";
import { daftarTonggak, hitungTonggak } from "@/lib/hitung/tonggak";
import { grup, uji, mendekati, samaDengan, benar } from "./uji";

grup("hitungRisiko", () => {
  uji("long: ukuran posisi lahir dari jatah risiko, bukan dari modal", () => {
    // Modal 100 juta, risiko 1% = 1 juta. Risiko per unit 10.000.
    // Maka boleh beli 100 unit, bukan sebanyak yang modal sanggup.
    const h = hitungRisiko({
      entry: 100_000, stop: 90_000, target: 130_000,
      modal: 100_000_000, risikoPersen: 1,
    });
    benar(h.valid);
    samaDengan(h.arah, "long");
    mendekati(h.nilaiRisiko, 1_000_000);
    mendekati(h.risikoPerUnit, 10_000);
    mendekati(h.ukuranPosisi, 100);
    mendekati(h.nilaiPosisi, 10_000_000);
    mendekati(h.porsiModalPersen, 10);
  });

  uji("rasio R:R dan potensi untung-rugi", () => {
    const h = hitungRisiko({
      entry: 100, stop: 90, target: 130, modal: 10_000, risikoPersen: 2,
    });
    mendekati(h.rasioRR, 3);
    mendekati(h.potensiRugi, 200);
    mendekati(h.potensiUntung, 600);
  });

  uji("short dikenali dari stop di atas entry", () => {
    const h = hitungRisiko({
      entry: 100, stop: 110, target: 80, modal: 10_000, risikoPersen: 1,
    });
    benar(h.valid);
    samaDengan(h.arah, "short");
    mendekati(h.risikoPerUnit, 10);
    mendekati(h.imbalanPerUnit, 20);
    mendekati(h.rasioRR, 2);
  });

  uji("target di sisi yang salah ditolak dengan pesan yang menjelaskan", () => {
    const h = hitungRisiko({
      entry: 100, stop: 90, target: 95, modal: 10_000, risikoPersen: 1,
    });
    benar(!h.valid);
    benar(h.pesan!.includes("target"), "pesan harus menyebut target");
  });

  uji("stop sama dengan entry ditolak, bukan menghasilkan pembagian nol", () => {
    const h = hitungRisiko({
      entry: 100, stop: 100, target: 120, modal: 10_000, risikoPersen: 1,
    });
    benar(!h.valid);
    samaDengan(h.ukuranPosisi, 0);
  });

  uji("angka bukan numerik ditolak", () => {
    const h = hitungRisiko({
      entry: NaN, stop: 90, target: 120, modal: 10_000, risikoPersen: 1,
    });
    benar(!h.valid);
  });

  uji("win rate impas turun saat R:R naik", () => {
    // R:R 1 butuh menang 50%. R:R 3 cukup menang 25%.
    mendekati(
      hitungRisiko({ entry: 100, stop: 90, target: 110, modal: 1, risikoPersen: 1 }).winRateImpas,
      50,
    );
    mendekati(
      hitungRisiko({ entry: 100, stop: 90, target: 130, modal: 1, risikoPersen: 1 }).winRateImpas,
      25,
    );
  });

  uji("modal nol tetap memberi rasio R:R, hanya ukuran posisinya nol", () => {
    const h = hitungRisiko({ entry: 100, stop: 90, target: 130, modal: 0, risikoPersen: 1 });
    benar(h.valid);
    mendekati(h.rasioRR, 3);
    samaDengan(h.ukuranPosisi, 0);
    samaDengan(h.porsiModalPersen, 0);
  });
});

grup("nilaiRR", () => {
  uji("di bawah 1 dinilai buruk", () => samaDengan(nilaiRR(0.8).nada, "buruk"));
  uji("3 ke atas dinilai baik", () => samaDengan(nilaiRR(3).nada, "baik"));
  uji("angka tidak valid tidak melempar", () => samaDengan(nilaiRR(NaN).nada, "buruk"));
});

grup("tonggak kekayaan", () => {
  uji("portofolio kecil mengejar tonggak berikutnya, bukan target akhir", () => {
    // Rp 8,1 juta menuju Rp 1 miliar: 0,81% terhadap target, tapi 81% menuju
    // tonggak Rp 10 juta. Angka kedua itu yang bergerak tiap minggu.
    const t = hitungTonggak(8_145_154, 1_000_000_000);
    samaDengan(t.bawah, 5_000_000);
    samaDengan(t.atas, 10_000_000);
    mendekati(t.porsi, (8_145_154 - 5_000_000) / 5_000_000, 1e-9);
    mendekati(t.porsiTarget * 100, 0.8145154, 1e-6);
  });

  uji("tepat di atas satu tonggak, yang dikejar adalah tonggak sesudahnya", () => {
    const t = hitungTonggak(10_000_000, 1_000_000_000);
    samaDengan(t.bawah, 10_000_000);
    samaDengan(t.atas, 25_000_000);
    samaDengan(t.porsi, 0);
  });

  uji("target akhir selalu jadi tonggak terakhir", () => {
    const t = hitungTonggak(600_000_000, 1_000_000_000);
    samaDengan(t.atas, 1_000_000_000);
    samaDengan(t.bawah, 500_000_000);
  });

  uji("target tercapai ditandai selesai", () => {
    const t = hitungTonggak(1_200_000_000, 1_000_000_000);
    benar(t.selesai);
    samaDengan(t.porsi, 1);
    samaDengan(t.porsiTarget, 1);
  });

  uji("portofolio nol tidak melempar", () => {
    const t = hitungTonggak(0, 1_000_000_000);
    samaDengan(t.porsi, 0);
    samaDengan(t.bawah, 0);
  });

  uji("target tidak valid dikembalikan kosong, bukan tak hingga", () => {
    const t = hitungTonggak(100, 0);
    samaDengan(t.porsiTarget, 0);
    benar(Number.isFinite(t.porsi));
  });

  uji("tangga memakai pola 1 / 2,5 / 5", () => {
    const d = daftarTonggak(1_000_000);
    benar(d.includes(250_000), "harus ada 250 ribu");
    benar(d.includes(500_000), "harus ada 500 ribu");
    samaDengan(d[d.length - 1], 1_000_000);
  });
});
