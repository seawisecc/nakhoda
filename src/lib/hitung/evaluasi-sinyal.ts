import {
  DAFTAR_SINYAL, kejadianSinyal, levelSinyal, type DefinisiSinyal, type LevelSinyal, type Lilin,
} from "./sinyal";
import { kalimatKesimpulan, nilaiUji, ujiDariIndeks, type HasilUji, type Penilaian } from "./uji-kejadian";

/* Penilaian seluruh daftar sinyal untuk satu ticker.
 *
 * Dulu hidup di dalam komponen tampilan Sinyal. Dipindah ke sini karena
 * pemindai posisi butuh penilaian yang persis sama: kalau pemindai dan
 * halaman Chart menghitung sendiri-sendiri, cepat atau lambat satu tanda
 * akan "lolos" di satu layar dan tidak di layar lain, dan tidak ada yang
 * tahu mana yang benar.
 */

/** Pola yang selesai dalam tiga sesi terakhir masih dianggap aktif. Lebih
 *  lama dari itu, harganya sudah bergerak dan entry-nya bukan lagi entry
 *  yang diuji. */
export const JENDELA_AKTIF = 3;
/** Sama dengan batas yang ditegakkan scripts/tambah-saran.ts. */
export const RR_MIN = 1.5;

export interface HasilSinyal {
  def: DefinisiSinyal;
  kejadian: number[];
  uji: HasilUji;
  nilai: Penilaian;
  kalimat: string;
  /** Indeks kemunculan terakhir di jendela aktif, atau null. */
  aktifDi: number | null;
  /** Hanya ada untuk tanda aktif yang lolos koreksi dan searah klaimnya. */
  level: LevelSinyal | null;
}

/** `deteksi` boleh diberikan dari luar supaya mengganti horizon tidak
 *  mengulang pemindaian 30 pola atas sepuluh tahun data. */
export function evaluasiSinyal(
  batang: Lilin[],
  horizon: number,
  ticker: string,
  deteksi: boolean[][] = DAFTAR_SINYAL.map((d) => d.deteksi(batang)),
): HasilSinyal[] {
  return DAFTAR_SINYAL.map((def, k) => {
    const kejadian = kejadianSinyal(deteksi[k], horizon);
    const uji = ujiDariIndeks(batang, kejadian, horizon);
    const nilai = nilaiUji(uji, DAFTAR_SINYAL.length, def.arah);
    let aktifDi: number | null = null;
    for (let i = batang.length - 1; i >= batang.length - JENDELA_AKTIF && i >= 0; i -= 1) {
      if (deteksi[k][i]) {
        aktifDi = i;
        break;
      }
    }
    const level = aktifDi !== null && nilai.tingkat === "catatan" && nilai.searah
      ? levelSinyal(batang, aktifDi, def, uji.median)
      : null;
    return {
      def, kejadian, uji, nilai, aktifDi, level,
      kalimat: kalimatKesimpulan(def.nama, ticker, uji, nilai, def.arah),
    };
  });
}

/** Tanda yang boleh jadi saran: punya level (artinya lolos koreksi dan
 *  searah), R:R minimal RR_MIN, dan kalau arahnya turun, tickernya memang
 *  dipegang. Tanda turun di saham yang tidak dipegang tidak bisa dijual,
 *  dia cuma berarti "jangan beli dulu". */
export function layakSaran(h: HasilSinyal, dipegang: boolean): boolean {
  return !!h.level && h.level.rr >= RR_MIN && (h.def.arah === "naik" || dipegang);
}

export interface RingkasanPindai {
  /** Semua tanda yang muncul di jendela aktif, lolos atau tidak. */
  aktif: HasilSinyal[];
  layak: HasilSinyal[];
}

export function ringkasPindai(hasil: HasilSinyal[], dipegang: boolean): RingkasanPindai {
  const aktif = hasil.filter((h) => h.aktifDi !== null);
  return { aktif, layak: aktif.filter((h) => layakSaran(h, dipegang)) };
}

/** Return tiap kejadian yang sudah selesai jendelanya, per tanggal masuk.
 *  Kejadian yang jendelanya belum selesai sengaja tidak ada di sini: hasil
 *  setengah jalan yang ditulis di chart akan terbaca sebagai hasil akhir. */
export function hasilPerTanggal(uji: HasilUji): Map<string, number> {
  return new Map(uji.kejadian.map((k) => [k.tanggalMasuk, k.hasil]));
}
