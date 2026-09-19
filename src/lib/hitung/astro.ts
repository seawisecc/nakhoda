import { Body, Ecliptic, GeoVector, SunPosition } from "astronomy-engine";
import { ujiDariIndeks, type BatangHarian, type HasilUji, type ReturnKejadian } from "./uji-kejadian";

export type { BatangHarian } from "./uji-kejadian";

/* Aspek planet dan uji apakah aspek itu berbarengan dengan gerak harga.
 *
 * Bagian pertama menghitung kapan dua planet membentuk sudut tertentu. Itu
 * astronomi biasa dan hasilnya pasti. Bagian kedua menguji klaimnya: apakah
 * return sesudah aspek berbeda dari return pada hari acak mana pun. Keduanya
 * sengaja hidup di satu berkas, karena penanda di chart tanpa ujinya cuma
 * mengundang mata untuk mengingat yang kebetulan pas dan melupakan sisanya.
 *
 * Posisi planet memakai astronomy-engine (VSOP87 dipangkas, galat di bawah
 * satu menit busur), bukan API ephemeris. Tidak butuh jaringan, dan hasilnya
 * sama di server, browser, dan tes.
 */

export type Planet =
  | "matahari" | "merkurius" | "venus" | "mars" | "jupiter"
  | "saturnus" | "uranus" | "neptunus" | "pluto";

/* Bulan sengaja tidak ada. Dia membentuk setiap aspek dengan setiap planet
   kira-kira sebulan sekali, jadi penandanya akan menutupi seluruh chart, dan
   pencarian harian di bawah terlalu kasar untuk geraknya yang 13° sehari. */
export const PLANET: Record<Planet, { nama: string; simbol: string; badan: Body }> = {
  matahari: { nama: "Matahari", simbol: "☉", badan: Body.Sun },
  merkurius: { nama: "Merkurius", simbol: "☿", badan: Body.Mercury },
  venus: { nama: "Venus", simbol: "♀", badan: Body.Venus },
  mars: { nama: "Mars", simbol: "♂", badan: Body.Mars },
  jupiter: { nama: "Jupiter", simbol: "♃", badan: Body.Jupiter },
  saturnus: { nama: "Saturnus", simbol: "♄", badan: Body.Saturn },
  uranus: { nama: "Uranus", simbol: "♅", badan: Body.Uranus },
  neptunus: { nama: "Neptunus", simbol: "♆", badan: Body.Neptune },
  pluto: { nama: "Pluto", simbol: "♇", badan: Body.Pluto },
};

export const DAFTAR_PLANET = Object.keys(PLANET) as Planet[];

export type JenisAspek = "konjungsi" | "sekstil" | "square" | "trigon" | "oposisi";

export const ASPEK: Record<JenisAspek, { nama: string; simbol: string; sudut: number }> = {
  konjungsi: { nama: "Konjungsi", simbol: "☌", sudut: 0 },
  sekstil: { nama: "Sekstil", simbol: "⚹", sudut: 60 },
  square: { nama: "Square", simbol: "□", sudut: 90 },
  trigon: { nama: "Trigon", simbol: "△", sudut: 120 },
  oposisi: { nama: "Oposisi", simbol: "☍", sudut: 180 },
};

export const DAFTAR_ASPEK = Object.keys(ASPEK) as JenisAspek[];

const HARI = 86_400_000;

/** Bujur ekliptika geosentris, zodiak tropis, dalam derajat [0, 360).
 *
 *  Geosentris karena itu yang dipakai astro trading pada umumnya: sudut
 *  seperti yang terlihat dari Bumi, termasuk retrograde. Aberasi ikut
 *  dikoreksi supaya angkanya cocok dengan ephemeris astrologi yang terbit. */
export function bujurPlanet(planet: Planet, waktu: number): number {
  const t = new Date(waktu);
  if (planet === "matahari") return SunPosition(t).elon;
  return Ecliptic(GeoVector(PLANET[planet].badan, t, true)).elon;
}

/** Sudut dibungkus ke (-180, 180]. */
function bungkus(d: number): number {
  const x = ((d % 360) + 360) % 360;
  return x > 180 ? x - 360 : x;
}

/** Jarak sudut dua planet, 0 sampai 180. */
export function jarakSudut(a: number, b: number): number {
  return Math.abs(bungkus(a - b));
}

export interface KejadianAspek {
  /** Saat aspek eksak, milidetik UTC. */
  waktu: number;
  a: Planet;
  b: Planet;
  aspek: JenisAspek;
}

type FungsiBujur = (planet: Planet, waktu: number) => number;

/** Semua saat eksak dua planet membentuk satu aspek dalam rentang waktu.
 *
 *  Square dan trigon punya dua sisi (a di depan b sejauh 90°, atau di
 *  belakangnya), dan keduanya dihitung sebagai aspek yang sama. Karena itu
 *  yang dilacak adalah selisih bertanda terhadap masing-masing sisi, bukan
 *  jarak sudut 0-180: jarak itu hanya menyentuh 0 dan 180 tanpa pernah
 *  menyeberanginya, sehingga konjungsi dan oposisi tidak akan pernah
 *  terdeteksi sebagai pergantian tanda.
 *
 *  Pindaian harian cukup halus untuk semua planet selain Bulan: gerak relatif
 *  tercepat (Matahari terhadap Merkurius retrograde) sekitar 3° sehari,
 *  sedangkan pergantian tanda diterima hanya bila kedua sisinya dalam 30°.
 *  Batas itu yang menolak lompatan palsu di ±180. Planet retrograde bisa
 *  mengulang aspek yang sama sampai tiga kali; masing-masing tercatat. */
export function cariAspek(
  a: Planet, b: Planet, aspek: JenisAspek, dari: number, sampai: number,
  bujur: FungsiBujur = bujurPlanet,
): KejadianAspek[] {
  if (a === b || !(sampai > dari)) return [];
  const sudut = ASPEK[aspek].sudut;
  const sisi = sudut === 0 || sudut === 180 ? [sudut] : [sudut, -sudut];
  const selisih = (t: number, target: number) => bungkus(bujur(a, t) - bujur(b, t) - target);

  const hasil: KejadianAspek[] = [];
  for (const target of sisi) {
    let t0 = dari;
    let g0 = selisih(t0, target);
    while (t0 < sampai) {
      const t1 = Math.min(t0 + HARI, sampai);
      const g1 = selisih(t1, target);
      // Tanda dinilai lewat "negatif atau bukan", jadi nilai tepat nol di
      // titik sampel dihitung sekali saja, bukan di dua langkah berturutan.
      if ((g0 < 0) !== (g1 < 0) && Math.abs(g0) < 30 && Math.abs(g1) < 30) {
        let kiri = t0;
        let kanan = t1;
        let gKiri = g0;
        // 30 kali belah dua dari satu hari: presisi di bawah satu milidetik,
        // jauh melampaui ketelitian ephemerisnya sendiri.
        for (let i = 0; i < 30; i += 1) {
          const tengah = (kiri + kanan) / 2;
          const gTengah = selisih(tengah, target);
          if ((gKiri < 0) === (gTengah < 0)) {
            kiri = tengah;
            gKiri = gTengah;
          } else {
            kanan = tengah;
          }
        }
        hasil.push({ waktu: Math.round((kiri + kanan) / 2), a, b, aspek });
      }
      t0 = t1;
      g0 = g1;
    }
  }
  return hasil.sort((x, y) => x.waktu - y.waktu);
}

/** Semua aspek dua planet sekaligus, diurutkan menurut waktu.
 *
 *  Bujur di titik sampel harian disimpan dan dipakai ulang lintas aspek.
 *  Kelima aspek memindai grid hari yang sama, jadi tanpa simpanan ini
 *  ephemerisnya dihitung sepuluh kali untuk setiap hari, dan untuk rentang
 *  sepuluh tahun itu terasa sebagai jeda saat memilih planet. */
export function cariSemuaAspek(
  a: Planet, b: Planet, daftar: JenisAspek[], dari: number, sampai: number,
  bujur: FungsiBujur = bujurPlanet,
): KejadianAspek[] {
  const simpanan = new Map<string, number>();
  const bujurTersimpan: FungsiBujur = (p, t) => {
    const kunci = `${p}:${t}`;
    let v = simpanan.get(kunci);
    if (v === undefined) {
      v = bujur(p, t);
      simpanan.set(kunci, v);
    }
    return v;
  };
  return daftar
    .flatMap((x) => cariAspek(a, b, x, dari, sampai, bujurTersimpan))
    .sort((x, y) => x.waktu - y.waktu);
}

/* ── Uji ──────────────────────────────────────────────────────────────── */

export interface ReturnAspek extends ReturnKejadian {
  waktuAspek: number;
}

export type HasilUjiAspek = HasilUji<ReturnAspek>;

/** Tanggal UTC dari milidetik, "YYYY-MM-DD". Tanggal sesi di data harian
 *  juga berupa tanggal kalender tanpa jam, jadi keduanya dibandingkan
 *  sebagai string yang urutannya sama dengan urutan waktu. */
export function tanggalUtc(waktu: number): string {
  return new Date(waktu).toISOString().slice(0, 10);
}

/** Indeks batang pertama yang tanggalnya pada atau sesudah `tanggal`, atau -1.
 *  Dipakai juga untuk menaruh penanda aspek yang jatuh di akhir pekan ke sesi
 *  bursa berikutnya. */
export function indeksBatangSejak(batang: BatangHarian[], tanggal: string): number {
  let kiri = 0;
  let kanan = batang.length;
  while (kiri < kanan) {
    const tengah = (kiri + kanan) >> 1;
    if (batang[tengah].tanggal < tanggal) kiri = tengah + 1;
    else kanan = tengah;
  }
  return kiri < batang.length ? kiri : -1;
}

/** Return h sesi di sekitar setiap aspek, lewat mesin uji bersama.
 *
 *  Titik awalnya tutup sesi TERAKHIR SEBELUM hari aspek, bukan tutup di hari
 *  aspek. Kalau hari aspek sendiri dipakai sebagai titik awal, gerak di hari
 *  itu, yang justru paling sering diklaim astro trading, terbuang dari
 *  pengukuran. Pola chart berbeda: dia baru diketahui setelah lilinnya
 *  tutup, jadi titik awalnya lilin itu sendiri. */
export function ujiAspek(
  batang: BatangHarian[], waktuAspek: number[], horizon: number,
  opsi: { sampel?: number; benih?: number } = {},
): HasilUjiAspek {
  const masuk = waktuAspek.map((w) => {
    const iAspek = indeksBatangSejak(batang, tanggalUtc(w));
    // -1 berarti aspeknya sesudah batang terakhir; titik awalnya batang
    // terakhir itu sendiri, tapi jendelanya jelas belum selesai.
    return (iAspek === -1 ? batang.length : iAspek) - 1;
  });
  const hasil = ujiDariIndeks(batang, masuk, horizon, opsi);
  // ujiDariIndeks melewatkan kejadian yang jendelanya tidak lengkap, jadi
  // waktu aspeknya dipasangkan ulang lewat tanggal masuk yang sama.
  const perMasuk = new Map<string, number[]>();
  masuk.forEach((i, k) => {
    if (i < 0 || i >= batang.length) return;
    const t = batang[i].tanggal;
    perMasuk.set(t, [...(perMasuk.get(t) ?? []), waktuAspek[k]]);
  });
  return {
    ...hasil,
    kejadian: hasil.kejadian.map((k) => ({ ...k, waktuAspek: perMasuk.get(k.tanggalMasuk)!.shift()! })),
  };
}
