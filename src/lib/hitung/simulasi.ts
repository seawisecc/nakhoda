import { daftarTonggak } from "./tonggak";
import { hariAntara } from "@/lib/tanggal";

/* Simulasi menuju target kekayaan.
 *
 * Satu langkah per bulan: nilai berbunga dulu sebesar return bulan itu, baru
 * setoran bulan itu masuk. Urutan ini disengaja. Setoran yang masuk di akhir
 * bulan belum sempat bekerja, jadi dia tidak boleh ikut berbunga di bulan yang
 * sama; urutan sebaliknya diam-diam memberi setiap setoran satu bulan bunga
 * gratis, dan selama puluhan bulan hadiah kecil itu menggeser tanggal tembus.
 *
 * Tidak ada rumus tertutup di sini, padahal ada (anuitas). Loop per bulan
 * dipilih karena jawaban yang dibutuhkan bukan cuma "bulan ke berapa", tapi
 * juga kapan tiap tonggak terlewati dan berapa bagian yang datang dari
 * setoran; ketiganya jatuh gratis dari loop yang sama.
 */

/** 50 tahun. Lewat dari ini, jawabannya bukan tanggal melainkan "tidak". */
export const BATAS_BULAN = 600;

export interface TonggakSimulasi {
  nilai: number;
  /** Bulan ke berapa dari sekarang tonggak ini terlewati. */
  bulan: number;
  /** Berapa bagian nilai saat itu yang berasal dari setoran (termasuk nilai awal). */
  porsiSetoran: number;
}

export interface HasilSimulasi {
  /** Bulan ke berapa target tercapai. 0 kalau sudah tercapai sekarang, null
   *  kalau tidak tercapai dalam BATAS_BULAN. */
  bulan: number | null;
  alasan: "tercapai" | "sudah" | "tidak-pernah" | "lewat-batas";
  /** Nilai di bulan tembus, atau di bulan terakhir yang disimulasikan. */
  nilaiAkhir: number;
  /** Nilai awal + seluruh setoran sampai bulan tembus. */
  totalSetor: number;
  /** Bagian nilai akhir yang datang dari return, bukan dari setoran. */
  totalReturn: number;
  tonggak: TonggakSimulasi[];
}

export function simulasiTarget(opsi: {
  awal: number;
  target: number;
  /** Return per bulan, dalam persen dari nilai saat itu. */
  returnPersen: number;
  setoran: number;
  batasBulan?: number;
}): HasilSimulasi {
  const { target } = opsi;
  const awal = Math.max(0, Number.isFinite(opsi.awal) ? opsi.awal : 0);
  const r = Number.isFinite(opsi.returnPersen) ? opsi.returnPersen / 100 : 0;
  const setoran = Math.max(0, Number.isFinite(opsi.setoran) ? opsi.setoran : 0);
  const batas = opsi.batasBulan ?? BATAS_BULAN;

  if (awal >= target) {
    return {
      bulan: 0, alasan: "sudah", nilaiAkhir: awal, totalSetor: awal,
      totalReturn: 0, tonggak: [],
    };
  }

  // Tanpa return positif dan tanpa setoran, nilainya tidak pernah naik. Dibedakan
  // dari "lewat batas": yang satu mustahil, yang satu cuma terlalu lama.
  // Return negatif dengan setoran mendekati titik keseimbangan setoran / -r
  // dari bawah atau dari atas, tapi tidak pernah melewatinya. Kalau titik itu
  // dan nilai awalnya sama-sama di bawah target, menunggu tidak menolong.
  const macet = r < 0 && setoran / -r < target;
  if ((r <= 0 && setoran <= 0) || macet) {
    return {
      bulan: null, alasan: "tidak-pernah", nilaiAkhir: awal, totalSetor: awal,
      totalReturn: 0, tonggak: [],
    };
  }

  const tangga = daftarTonggak(target).filter((t) => t > awal);
  const tonggak: TonggakSimulasi[] = [];
  let nilai = awal;
  let setor = awal;

  for (let bulan = 1; bulan <= batas; bulan += 1) {
    nilai = nilai * (1 + r) + setoran;
    setor += setoran;
    while (tangga.length && nilai >= tangga[0]) {
      tonggak.push({ nilai: tangga.shift()!, bulan, porsiSetoran: Math.min(1, setor / nilai) });
    }
    if (nilai >= target) {
      return {
        bulan, alasan: "tercapai", nilaiAkhir: nilai, totalSetor: setor,
        totalReturn: nilai - setor, tonggak,
      };
    }
  }

  return {
    bulan: null, alasan: "lewat-batas", nilaiAkhir: nilai, totalSetor: setor,
    totalReturn: nilai - setor, tonggak,
  };
}

/** Rata-rata hari per bulan kalender, dipakai untuk memecah jarak hari jadi
 *  pangkat bulanan. */
const HARI_PER_BULAN = 365.25 / 12;

/** Return per bulan yang benar-benar terjadi, dalam persen, dari arus modal
 *  dan nilai hari ini.
 *
 *  Ini IRR bulanan (money-weighted): satu tingkat bunga majemuk yang, kalau
 *  diterapkan ke setiap setoran sejak hari masuknya, menghasilkan persis nilai
 *  portofolio hari ini. Dipakai sebagai pembanding simulasi karena bentuknya
 *  sama dengan asumsi simulasi itu sendiri: bunga majemuk atas modal yang
 *  sedang bekerja, dengan setoran yang masuk bertahap.
 *
 *  Bukan laba total dibagi jumlah bulan. Pembagian itu menganggap setoran
 *  bulan lalu sudah bekerja sejak hari pertama, dan hasilnya meremehkan return
 *  setiap kali ada setoran baru yang besar.
 *
 *  null kalau riwayatnya belum sebulan: dua minggu data yang disetahunkan jadi
 *  bulanan bisa menghasilkan angka apa saja. */
export function returnBulananTersirat(
  arus: readonly { tanggal: string; jumlah: number }[],
  nilaiKini: number,
  tanggalKini: string,
): number | null {
  const dipakai = arus.filter((a) => a.tanggal <= tanggalKini && a.jumlah !== 0);
  if (!dipakai.length || !(nilaiKini > 0)) return null;
  const pertama = dipakai.reduce((m, a) => (a.tanggal < m ? a.tanggal : m), dipakai[0].tanggal);
  if (hariAntara(pertama, tanggalKini) < HARI_PER_BULAN) return null;

  const nilaiDari = (r: number) =>
    dipakai.reduce(
      (s, a) => s + a.jumlah * (1 + r) ** (hariAntara(a.tanggal, tanggalKini) / HARI_PER_BULAN),
      0,
    );

  // Bisection. Dengan setoran yang semuanya positif, nilaiDari naik monoton
  // terhadap r, jadi akarnya tunggal di rentang ini.
  let bawah = -0.5;
  let atas = 1;
  if (nilaiDari(bawah) > nilaiKini || nilaiDari(atas) < nilaiKini) return null;
  for (let i = 0; i < 200; i += 1) {
    const tengah = (bawah + atas) / 2;
    if (nilaiDari(tengah) < nilaiKini) bawah = tengah;
    else atas = tengah;
  }
  return ((bawah + atas) / 2) * 100;
}
