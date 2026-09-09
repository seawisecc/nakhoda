export interface InputRisiko {
  entry: number;
  stop: number;
  target: number;
  /** Modal yang dipertaruhkan seluruhnya, dalam mata uang harga di atas. */
  modal: number;
  /** Berapa persen modal yang rela hilang kalau stop kena. */
  risikoPersen: number;
}

export interface HasilRisiko {
  valid: boolean;
  pesan?: string;
  arah: "long" | "short";
  risikoPerUnit: number;
  imbalanPerUnit: number;
  /** Imbalan dibagi risiko. 2 berarti "untung 2 kali lipat dari yang dirisikokan". */
  rasioRR: number;
  /** Rupiah/dolar yang hilang kalau stop kena. Ini angka yang dikunci lebih dulu. */
  nilaiRisiko: number;
  /** Berapa unit yang boleh dibeli supaya kerugian tidak melewati nilaiRisiko. */
  ukuranPosisi: number;
  nilaiPosisi: number;
  potensiRugi: number;
  potensiUntung: number;
  /** Berapa persen dari seluruh modal yang terpakai untuk posisi ini. */
  porsiModalPersen: number;
  /** Win rate minimum agar strategi dengan R:R ini tidak merugi jangka panjang. */
  winRateImpas: number;
}

const KOSONG: HasilRisiko = {
  valid: false,
  arah: "long",
  risikoPerUnit: 0,
  imbalanPerUnit: 0,
  rasioRR: 0,
  nilaiRisiko: 0,
  ukuranPosisi: 0,
  nilaiPosisi: 0,
  potensiRugi: 0,
  potensiUntung: 0,
  porsiModalPersen: 0,
  winRateImpas: 0,
};

/** Kalkulator ukuran posisi.
 *
 *  Urutannya sengaja dibalik dari cara kebanyakan orang trading: yang
 *  ditentukan lebih dulu adalah berapa rupiah yang rela hilang, baru dari situ
 *  lahir berapa unit yang boleh dibeli. Bukan sebaliknya. Dengan begitu satu
 *  trade yang salah tidak pernah bisa melukai lebih dalam dari jatah risikonya.
 *
 *  Mendukung dua arah: stop di bawah entry berarti long, stop di atas entry
 *  berarti short. */
export function hitungRisiko(input: InputRisiko): HasilRisiko {
  const { entry, stop, target, modal, risikoPersen } = input;

  if (![entry, stop, target].every((n) => Number.isFinite(n) && n > 0)) {
    return { ...KOSONG, pesan: "Entry, stop, dan target harus diisi angka positif." };
  }
  if (entry === stop) {
    return { ...KOSONG, pesan: "Stop tidak boleh sama dengan harga entry." };
  }

  const arah: "long" | "short" = stop < entry ? "long" : "short";
  const risikoPerUnit = Math.abs(entry - stop);
  const imbalanPerUnit = arah === "long" ? target - entry : entry - target;

  if (imbalanPerUnit <= 0) {
    return {
      ...KOSONG,
      arah,
      risikoPerUnit,
      pesan:
        arah === "long"
          ? "Untuk posisi long, target harus di atas harga entry."
          : "Untuk posisi short, target harus di bawah harga entry.",
    };
  }

  const rasioRR = imbalanPerUnit / risikoPerUnit;
  const nilaiRisiko =
    Number.isFinite(modal) && Number.isFinite(risikoPersen)
      ? Math.max(0, modal) * (Math.max(0, risikoPersen) / 100)
      : 0;
  const ukuranPosisi = nilaiRisiko > 0 ? nilaiRisiko / risikoPerUnit : 0;
  const nilaiPosisi = ukuranPosisi * entry;

  return {
    valid: true,
    arah,
    risikoPerUnit,
    imbalanPerUnit,
    rasioRR,
    nilaiRisiko,
    ukuranPosisi,
    nilaiPosisi,
    potensiRugi: ukuranPosisi * risikoPerUnit,
    potensiUntung: ukuranPosisi * imbalanPerUnit,
    porsiModalPersen: modal > 0 ? (nilaiPosisi / modal) * 100 : 0,
    // Dengan R:R 2, cukup menang 1 dari 3 untuk impas. Angka ini yang bikin
    // R:R terasa konkret, bukan sekadar rasio tanpa konsekuensi.
    winRateImpas: (1 / (1 + rasioRR)) * 100,
  };
}

/** Penilaian kualitatif sebuah R:R. Batasnya konvensi trading umum, bukan
 *  aturan pasti: di bawah 1 berarti risiko lebih besar dari imbalan. */
export function nilaiRR(rasio: number): {
  label: string;
  nada: "baik" | "cukup" | "buruk";
} {
  if (!Number.isFinite(rasio) || rasio <= 0) return { label: "Tidak valid", nada: "buruk" };
  if (rasio < 1) return { label: "Kurang, risiko melebihi imbalan", nada: "buruk" };
  if (rasio < 1.5) return { label: "Tipis", nada: "cukup" };
  if (rasio < 2) return { label: "Layak", nada: "cukup" };
  if (rasio < 3) return { label: "Bagus", nada: "baik" };
  return { label: "Sangat bagus", nada: "baik" };
}
