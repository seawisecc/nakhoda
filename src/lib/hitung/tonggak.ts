/** Tangga tonggak menuju target kekayaan.
 *
 *  Masalah yang diselesaikan: target Rp 1 miliar itu benar sebagai tujuan,
 *  tapi buruk sebagai ukuran harian. Portofolio Rp 8 juta akan menampilkan
 *  batang 0,8% yang praktis kosong selama bertahun-tahun, dan batang yang
 *  tidak pernah bergerak berhenti dibaca sebagai informasi.
 *
 *  Yang dipakai di sini: tangga 1 / 2,5 / 5 di tiap kelipatan sepuluh. Batang
 *  mengukur kemajuan menuju tonggak BERIKUTNYA, sementara target akhir tetap
 *  ditampilkan sebagai konteks. Jadi ada dua angka yang keduanya jujur: satu
 *  yang bergerak tiap minggu, dan satu yang mengingatkan sedang menuju ke mana.
 */
export interface Tonggak {
  /** Tonggak yang sudah terlewati, 0 kalau belum ada. */
  bawah: number;
  /** Tonggak berikutnya yang dikejar. */
  atas: number;
  /** Kemajuan di dalam petak ini, 0 sampai 1. */
  porsi: number;
  /** Kemajuan terhadap target akhir, 0 sampai 1. */
  porsiTarget: number;
  /** Benar kalau target akhir sudah tercapai. */
  selesai: boolean;
}

const POLA = [1, 2.5, 5];

/** Semua tonggak dari kelipatan terkecil sampai target, target selalu ikut. */
export function daftarTonggak(target: number): number[] {
  if (!(target > 0) || !Number.isFinite(target)) return [];
  const hasil: number[] = [];
  for (let pangkat = 0; pangkat <= 15; pangkat += 1) {
    for (const m of POLA) {
      const v = m * 10 ** pangkat;
      if (v >= target) {
        hasil.push(target);
        return hasil;
      }
      hasil.push(v);
    }
  }
  hasil.push(target);
  return hasil;
}

export function hitungTonggak(nilai: number, target: number): Tonggak {
  const kosong: Tonggak = { bawah: 0, atas: target, porsi: 0, porsiTarget: 0, selesai: false };
  if (!(target > 0) || !Number.isFinite(target) || !Number.isFinite(nilai)) return kosong;

  const porsiTarget = Math.max(0, Math.min(1, nilai / target));
  if (nilai >= target) {
    return { bawah: target, atas: target, porsi: 1, porsiTarget: 1, selesai: true };
  }

  const tangga = daftarTonggak(target);
  // Tonggak berikutnya adalah yang pertama melampaui nilai sekarang. Tepat di
  // atas sebuah tonggak, yang dikejar adalah tonggak sesudahnya, bukan yang
  // baru saja dilewati.
  const atas = tangga.find((t) => t > nilai) ?? target;
  const bawah = [...tangga].reverse().find((t) => t <= nilai) ?? 0;
  const rentang = atas - bawah;

  return {
    bawah,
    atas,
    porsi: rentang > 0 ? Math.max(0, Math.min(1, (nilai - bawah) / rentang)) : 0,
    porsiTarget,
    selesai: false,
  };
}
