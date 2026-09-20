import type { Arah } from "./uji-kejadian";

/* Pola lilin, indikator, breakout, dan pola ganda, dideteksi dari batang
 * harian.
 *
 * Setiap definisi di sini sengaja kaku dan tertulis sebagai angka. Pola yang
 * dinilai dengan mata ("kelihatannya seperti hammer") tidak bisa diuji,
 * karena mata yang sama yang kemudian menilai apakah polanya berhasil.
 * Batas-batasnya mengikuti definisi buku teks yang umum (Nison untuk lilin,
 * Wilder untuk RSI, Appel untuk MACD); yang penting bukan batasnya paling
 * benar, tapi batasnya sama untuk setiap kejadian.
 *
 * Head and shoulders, segitiga, dan bendera tidak ada di sini. Dua trader
 * menggambar garisnya berbeda untuk chart yang sama, jadi deteksi otomatisnya
 * akan menguji definisi kita sendiri, bukan pola yang orang maksud. Double
 * bottom dan double top masuk karena keduanya bisa ditulis sebagai angka:
 * dua titik balik sejajar, satu leher, satu penembusan.
 */

export interface Lilin {
  tanggal: string;
  buka: number;
  tinggi: number;
  rendah: number;
  tutup: number;
  volume?: number;
}

export type KelompokSinyal = "lilin" | "indikator" | "breakout" | "pola";

export interface DefinisiSinyal {
  id: string;
  nama: string;
  arah: Arah;
  kelompok: KelompokSinyal;
  /** Berapa lilin yang dibentuk pola ini. Titik terendah (atau tertinggi)
   *  lilin-lilin itu yang menjadi stop: kalau harga menembusnya, pola yang
   *  jadi alasan masuk sudah terhapus. Untuk indikator dan breakout, yang
   *  tidak punya bentuk lilin, dipakai ayunan sepuluh sesi terakhir. */
  panjangStop: number;
  /** Stop untuk pola yang bentuknya tidak sepanjang jumlah lilin tetap.
   *  Double bottom bisa selesai 5 atau 60 sesi setelah dasarnya, jadi
   *  stopnya harus dicari dari bentuk polanya, bukan dari n lilin terakhir. */
  titikStop?: (b: Lilin[], i: number) => number | null;
  keterangan: string;
  /** true di setiap indeks tempat pola ini selesai terbentuk. */
  deteksi: (b: Lilin[]) => boolean[];
}

/* ── Indikator dasar ────────────────────────────────────────────────────── */

export function sma(nilai: number[], n: number): (number | null)[] {
  const hasil: (number | null)[] = [];
  let jumlah = 0;
  for (let i = 0; i < nilai.length; i += 1) {
    jumlah += nilai[i];
    if (i >= n) jumlah -= nilai[i - n];
    hasil.push(i >= n - 1 ? jumlah / n : null);
  }
  return hasil;
}

/** EMA yang dibenihi SMA n pertama, seperti hampir semua platform chart.
 *  Membenihinya dengan nilai pertama saja membuat puluhan titik awalnya
 *  berbeda dari yang terlihat di TradingView. */
export function ema(nilai: number[], n: number): (number | null)[] {
  const k = 2 / (n + 1);
  const hasil: (number | null)[] = [];
  let sebelum: number | null = null;
  for (let i = 0; i < nilai.length; i += 1) {
    if (i < n - 1) {
      hasil.push(null);
      continue;
    }
    if (sebelum === null) {
      let jumlah = 0;
      for (let j = i - n + 1; j <= i; j += 1) jumlah += nilai[j];
      sebelum = jumlah / n;
    } else {
      sebelum = nilai[i] * k + sebelum * (1 - k);
    }
    hasil.push(sebelum);
  }
  return hasil;
}

/** RSI Wilder: rata-rata naik dan turun dihaluskan dengan faktor 1/n, bukan
 *  EMA biasa 2/(n+1). Itu definisi aslinya, dan yang dipakai TradingView. */
export function rsi(tutup: number[], n = 14): (number | null)[] {
  const hasil: (number | null)[] = tutup.map(() => null);
  if (tutup.length <= n) return hasil;
  let naik = 0;
  let turun = 0;
  for (let i = 1; i <= n; i += 1) {
    const d = tutup[i] - tutup[i - 1];
    if (d > 0) naik += d;
    else turun -= d;
  }
  naik /= n;
  turun /= n;
  const nilai = () => (turun === 0 ? (naik === 0 ? 50 : 100) : 100 - 100 / (1 + naik / turun));
  hasil[n] = nilai();
  for (let i = n + 1; i < tutup.length; i += 1) {
    const d = tutup[i] - tutup[i - 1];
    naik = (naik * (n - 1) + Math.max(d, 0)) / n;
    turun = (turun * (n - 1) + Math.max(-d, 0)) / n;
    hasil[i] = nilai();
  }
  return hasil;
}

export function macd(tutup: number[], cepat = 12, lambat = 26, isyarat = 9) {
  const a = ema(tutup, cepat);
  const b = ema(tutup, lambat);
  const garis = tutup.map((_, i) => (a[i] !== null && b[i] !== null ? a[i]! - b[i]! : null));
  const mulai = garis.findIndex((x) => x !== null);
  const sinyal: (number | null)[] = garis.map(() => null);
  if (mulai !== -1) {
    const e = ema(garis.slice(mulai) as number[], isyarat);
    e.forEach((x, i) => { sinyal[mulai + i] = x; });
  }
  return { garis, sinyal };
}

/* ── Bantuan ────────────────────────────────────────────────────────────── */

const badan = (l: Lilin) => Math.abs(l.tutup - l.buka);
const rentang = (l: Lilin) => l.tinggi - l.rendah;
const hijau = (l: Lilin) => l.tutup > l.buka;
const merah = (l: Lilin) => l.tutup < l.buka;

/** Pola pembalikan hanya berarti setelah ada yang dibalik. Tren pendek
 *  diukur dari tutup lima sesi sebelumnya; hammer di tengah kenaikan bukan
 *  hammer, cuma lilin berekor. */
function turunSebelum(b: Lilin[], i: number): boolean {
  return i >= 5 && b[i].tutup < b[i - 5].tutup;
}
function naikSebelum(b: Lilin[], i: number): boolean {
  return i >= 5 && b[i].tutup > b[i - 5].tutup;
}

function tiapIndeks(b: Lilin[], mulai: number, uji: (i: number) => boolean): boolean[] {
  return b.map((_, i) => i >= mulai && uji(i));
}

/** Menyilang: kondisi salah kemarin dan benar hari ini. Keadaan yang
 *  bertahan (RSI di bawah 30 selama seminggu) dihitung sekali, di hari
 *  masuknya, bukan tujuh kali. */
function silang(kondisi: (i: number) => boolean | null, b: Lilin[], mulai: number): boolean[] {
  return tiapIndeks(b, Math.max(1, mulai), (i) => kondisi(i) === true && kondisi(i - 1) === false);
}

function tertinggiSebelum(b: Lilin[], i: number, n: number): number {
  let m = -Infinity;
  for (let j = i - n; j < i; j += 1) m = Math.max(m, b[j].tinggi);
  return m;
}
function terendahSebelum(b: Lilin[], i: number, n: number): number {
  let m = Infinity;
  for (let j = i - n; j < i; j += 1) m = Math.min(m, b[j].rendah);
  return m;
}

function engulfing(b: Lilin[], i: number, arah: Arah): boolean {
  const k = b[i - 1];
  const s = b[i];
  if (arah === "naik") {
    return merah(k) && hijau(s) && s.buka <= k.tutup && s.tutup >= k.buka
      && badan(s) > badan(k) && turunSebelum(b, i - 1);
  }
  return hijau(k) && merah(s) && s.buka >= k.tutup && s.tutup <= k.buka
    && badan(s) > badan(k) && naikSebelum(b, i - 1);
}

/** Hammer dan shooting star: badan kecil di satu ujung, ekor panjang di
 *  ujung lain. Ekornya minimal dua kali badan dan 60% rentang, ekor
 *  seberangnya paling banyak 15%. */
function ekorPanjang(b: Lilin[], i: number, arah: Arah): boolean {
  const l = b[i];
  const r = rentang(l);
  if (!(r > 0) || badan(l) > r * 0.35) return false;
  const bawah = Math.min(l.buka, l.tutup) - l.rendah;
  const atas = l.tinggi - Math.max(l.buka, l.tutup);
  if (arah === "naik") {
    return bawah >= 2 * badan(l) && bawah >= r * 0.6 && atas <= r * 0.15 && turunSebelum(b, i);
  }
  return atas >= 2 * badan(l) && atas >= r * 0.6 && bawah <= r * 0.15 && naikSebelum(b, i);
}

/** Morning star dan evening star: lilin panjang, lilin kecil yang ragu,
 *  lalu lilin berlawanan yang menutup melewati tengah badan lilin pertama. */
function bintang(b: Lilin[], i: number, arah: Arah): boolean {
  const [p, t, k] = [b[i - 2], b[i - 1], b[i]];
  const r = rentang(p);
  if (!(r > 0) || badan(p) < r * 0.5 || badan(t) > badan(p) * 0.3) return false;
  const tengah = (p.buka + p.tutup) / 2;
  if (arah === "naik") return merah(p) && hijau(k) && k.tutup > tengah && turunSebelum(b, i - 2);
  return hijau(p) && merah(k) && k.tutup < tengah && naikSebelum(b, i - 2);
}

/** Lonjakan volume: dua kali rata-rata 20 sesi sebelumnya, dengan lilin
 *  yang menutup searah. Volume tanpa arah cuma berarti ramai. */
function lonjakanVolume(b: Lilin[], i: number, arah: Arah): boolean {
  const v = b[i].volume;
  if (!v) return false;
  let jumlah = 0;
  for (let j = i - 20; j < i; j += 1) {
    const x = b[j].volume;
    if (!x) return false;
    jumlah += x;
  }
  if (v < 2 * (jumlah / 20)) return false;
  return arah === "naik"
    ? hijau(b[i]) && b[i].tutup > b[i - 1].tutup
    : merah(b[i]) && b[i].tutup < b[i - 1].tutup;
}

/* ── Pola ganda ─────────────────────────────────────────────────────────── */

/** Jarak dari titik balik ke lilin yang mengonfirmasinya. Pivot baru
 *  dianggap sah kalau lima sesi di kiri dan kanannya tidak melewatinya;
 *  lebih kecil dari itu, setiap riak kecil jadi "titik balik". */
const SAYAP = 5;
const JARAK_MIN = 10;
const JARAK_MAKS = 120;
/** Dua kaki dianggap sama tinggi kalau selisihnya di bawah 4%, dan lehernya
 *  harus 3% di atas kaki supaya yang dihitung pola, bukan sisi datar. */
const BEDA_KAKI = 0.04;
const DALAM_MIN = 0.03;
/** Penembusan leher yang datang lebih dari 40 sesi sesudah kaki kedua
 *  bukan lagi konfirmasi pola itu; harganya sudah punya cerita lain. */
const TUNDA_MAKS = 40;

function pivot(b: Lilin[], i: number, arah: Arah): boolean {
  if (i < SAYAP || i + SAYAP >= b.length) return false;
  for (let j = i - SAYAP; j <= i + SAYAP; j += 1) {
    if (j === i) continue;
    if (arah === "naik" ? b[j].rendah < b[i].rendah : b[j].tinggi > b[i].tinggi) return false;
  }
  return true;
}

/** Indeks semua titik balik, dihitung sekali untuk seluruh deret.
 *
 *  Pencarian garis tren memeriksa jendela 120 sesi di setiap lilin; tanpa
 *  daftar ini, pivot yang sama dihitung ulang ratusan kali dan pemindaian
 *  sepuluh tahun terasa sebagai jeda saat membuka halaman. */
export function daftarPivot(b: Lilin[], arah: Arah): number[] {
  const hasil: number[] = [];
  for (let i = SAYAP; i + SAYAP < b.length; i += 1) if (pivot(b, i, arah)) hasil.push(i);
  return hasil;
}

/** Pivot yang sudah bisa diketahui pada lilin ke-i.
 *
 *  Pivot baru sah setelah SAYAP lilin di kanannya lewat, jadi pada hari i
 *  yang boleh dipakai hanya pivot sampai i - SAYAP. Memakai pivot yang
 *  "terlihat" di i padahal baru terkonfirmasi lima hari kemudian adalah cara
 *  paling mudah membuat backtest terlihat hebat dan tidak bisa dipakai. */
function pivotSampai(daftar: number[], i: number, jendela: number): number[] {
  // Dipotong lewat pencarian biner, bukan filter: filter atas seluruh daftar
  // di setiap lilin membuat pemindaian sepuluh tahun berlipat jadi ratusan
  // juta perbandingan.
  const batas = (nilai: number) => {
    let kiri = 0;
    let kanan = daftar.length;
    while (kiri < kanan) {
      const tengah = (kiri + kanan) >> 1;
      if (daftar[tengah] < nilai) kiri = tengah + 1;
      else kanan = tengah;
    }
    return kiri;
  };
  return daftar.slice(batas(i - jendela), batas(i - SAYAP + 1));
}

export interface GarisTren {
  /** Indeks dua pivot yang dilalui garis. */
  dari: number;
  sampai: number;
  hargaDari: number;
  hargaSampai: number;
  /** Berapa pivot yang menyentuh garis dalam 1,5%. */
  sentuh: number;
}

const JENDELA_TREN = 120;
/** Garis tren butuh minimal tiga titik balik searah. Dua titik selalu bisa
 *  dihubungkan garis, jadi garis dua titik tidak mengatakan apa-apa. */
const PIVOT_MIN = 3;

export function hargaGaris(g: GarisTren, i: number): number {
  const kemiringan = (g.hargaSampai - g.hargaDari) / (g.sampai - g.dari);
  return g.hargaDari + kemiringan * (i - g.dari);
}

/** Garis tren yang berlaku pada lilin ke-i: naik berarti garis penyangga di
 *  bawah harga (dasar yang makin tinggi), turun berarti garis penahan di
 *  atasnya (puncak yang makin rendah).
 *
 *  Garis ditarik lewat pivot pertama dan terakhir dari tiga pivot terakhir,
 *  lalu ditolak kalau ada tutup yang menembusnya lebih dari 3% di antara
 *  keduanya. Tanpa syarat itu, tiga titik mana pun bisa dihubungkan dan
 *  hasilnya garis yang sudah lama dilanggar. */
export function garisTren(b: Lilin[], i: number, arah: Arah, daftar: number[]): GarisTren | null {
  const p = pivotSampai(daftar, i, JENDELA_TREN);
  if (p.length < PIVOT_MIN) return null;
  const tiga = p.slice(-PIVOT_MIN);
  const harga = (j: number) => (arah === "naik" ? b[j].rendah : b[j].tinggi);
  // Naik: dasar harus makin tinggi. Turun: puncak makin rendah.
  for (let k = 1; k < tiga.length; k += 1) {
    const lebihTinggi = harga(tiga[k]) > harga(tiga[k - 1]);
    if (arah === "naik" ? !lebihTinggi : lebihTinggi) return null;
  }
  const g: GarisTren = {
    dari: tiga[0], sampai: tiga[tiga.length - 1],
    hargaDari: harga(tiga[0]), hargaSampai: harga(tiga[tiga.length - 1]),
    sentuh: 0,
  };
  for (let j = g.dari; j <= i; j += 1) {
    const garis = hargaGaris(g, j);
    const tembus = arah === "naik" ? b[j].tutup < garis * 0.97 : b[j].tutup > garis * 1.03;
    if (tembus && j < i) return null;
  }
  g.sentuh = tiga.filter((j) => Math.abs(harga(j) - hargaGaris(g, j)) / hargaGaris(g, j) <= 0.015).length;
  return g;
}

export interface LevelMendatar {
  harga: number;
  /** Indeks pivot yang membentuknya. */
  titik: number[];
}

const JENDELA_LEVEL = 180;
/** Dua pivot dianggap satu level kalau jaraknya di bawah 2%. */
const LEBAR_LEVEL = 0.02;

/** Level mendatar yang berlaku pada lilin ke-i: penahan di atas harga
 *  (arah turun) atau penyangga di bawahnya (arah naik), dari tiga titik
 *  balik atau lebih yang berhenti di harga yang hampir sama. */
export function levelMendatar(b: Lilin[], i: number, arah: Arah, daftar: number[]): LevelMendatar | null {
  const p = pivotSampai(daftar, i, JENDELA_LEVEL);
  if (p.length < PIVOT_MIN) return null;
  const harga = (j: number) => (arah === "naik" ? b[j].rendah : b[j].tinggi);
  const kini = b[i].tutup;
  let terbaik: LevelMendatar | null = null;
  for (const inti of p) {
    const acuan = harga(inti);
    // Penahan harus di atas harga sekarang, penyangga di bawahnya. Level
    // yang sudah dilewati harga bukan level yang sedang dijaga.
    if (arah === "naik" ? acuan >= kini : acuan <= kini) continue;
    const titik = p.filter((j) => Math.abs(harga(j) - acuan) / acuan <= LEBAR_LEVEL);
    if (titik.length < PIVOT_MIN) continue;
    const rata = titik.reduce((sum, j) => sum + harga(j), 0) / titik.length;
    // Yang dipilih level terdekat ke harga sekarang: itu yang akan ditemui
    // lebih dulu, dan itu yang jadi pemicunya.
    if (!terbaik || Math.abs(rata - kini) < Math.abs(terbaik.harga - kini)) {
      terbaik = { harga: rata, titik };
    }
  }
  return terbaik;
}

export interface PolaGanda {
  /** Indeks kaki pertama dan kedua. */
  kaki1: number;
  kaki2: number;
  /** Harga leher: puncak di antara kedua kaki (atau lembah, untuk top). */
  leher: number;
  /** Titik ekstrem pola, tempat stop ditaruh. */
  ekstrem: number;
}

/** Double bottom (arah naik) atau double top (arah turun) yang penembusan
 *  lehernya terjadi tepat di lilin i.
 *
 *  Yang ditandai adalah penembusan leher, bukan kaki keduanya. Kaki kedua
 *  hanya terlihat sebagai kaki setelah harga berbalik dan melewati leher;
 *  menandai kaki itu sendiri berarti menandai keadaan yang baru diketahui
 *  belakangan, dan uji yang dibangun di atasnya akan tampak jauh lebih
 *  pintar daripada yang bisa dipakai sungguhan. */
export function polaGanda(b: Lilin[], i: number, arah: Arah): PolaGanda | null {
  if (i < JARAK_MIN + SAYAP + 1 || i >= b.length) return null;
  const kaki: number[] = [];
  for (let j = Math.max(SAYAP, i - JARAK_MAKS - TUNDA_MAKS); j <= i - SAYAP - 1; j += 1) {
    if (pivot(b, j, arah)) kaki.push(j);
  }
  if (kaki.length < 2) return null;

  const harga = (j: number) => (arah === "naik" ? b[j].rendah : b[j].tinggi);
  // Dari belakang: pasangan kaki terakhir yang memenuhi syarat, karena itu
  // yang lehernya baru saja ditembus.
  for (let x = kaki.length - 1; x >= 1; x -= 1) {
    const kaki2 = kaki[x];
    if (i - kaki2 > TUNDA_MAKS) break;
    for (let y = x - 1; y >= 0; y -= 1) {
      const kaki1 = kaki[y];
      const jarak = kaki2 - kaki1;
      if (jarak > JARAK_MAKS) break;
      if (jarak < JARAK_MIN) continue;
      if (Math.abs(harga(kaki2) - harga(kaki1)) / harga(kaki1) > BEDA_KAKI) continue;
      let leher = arah === "naik" ? -Infinity : Infinity;
      for (let j = kaki1; j <= kaki2; j += 1) {
        leher = arah === "naik" ? Math.max(leher, b[j].tinggi) : Math.min(leher, b[j].rendah);
      }
      const dasar = Math.max(harga(kaki1), harga(kaki2));
      const puncak = Math.min(harga(kaki1), harga(kaki2));
      const cukupDalam = arah === "naik"
        ? leher >= dasar * (1 + DALAM_MIN)
        : leher <= puncak * (1 - DALAM_MIN);
      if (!cukupDalam) continue;
      const tembus = arah === "naik"
        ? b[i].tutup > leher && b[i - 1].tutup <= leher
        : b[i].tutup < leher && b[i - 1].tutup >= leher;
      if (!tembus) continue;
      const ekstrem = arah === "naik"
        ? Math.min(harga(kaki1), harga(kaki2))
        : Math.max(harga(kaki1), harga(kaki2));
      return { kaki1, kaki2, leher, ekstrem };
    }
  }
  return null;
}

/** Double bottom atau top yang kakinya sudah lengkap tapi lehernya BELUM
 *  ditembus, dilihat dari lilin ke-i.
 *
 *  Ini yang digambar sebagai "sedang terbentuk". Pola yang belum tembus
 *  belum boleh dihitung sebagai kejadian di uji mana pun: sebagian besar
 *  tidak akan pernah menembus lehernya, dan memasukkannya berarti menilai
 *  pola dengan informasi yang belum ada. */
export function polaGandaTerbentuk(b: Lilin[], i: number, arah: Arah): PolaGanda | null {
  if (i < JARAK_MIN + SAYAP + 1 || i >= b.length) return null;
  const kaki: number[] = [];
  for (let j = Math.max(SAYAP, i - JARAK_MAKS - TUNDA_MAKS); j <= i - SAYAP; j += 1) {
    if (pivot(b, j, arah)) kaki.push(j);
  }
  if (kaki.length < 2) return null;
  const harga = (j: number) => (arah === "naik" ? b[j].rendah : b[j].tinggi);

  for (let x = kaki.length - 1; x >= 1; x -= 1) {
    const kaki2 = kaki[x];
    if (i - kaki2 > TUNDA_MAKS) break;
    for (let y = x - 1; y >= 0; y -= 1) {
      const kaki1 = kaki[y];
      const jarak = kaki2 - kaki1;
      if (jarak > JARAK_MAKS) break;
      if (jarak < JARAK_MIN) continue;
      if (Math.abs(harga(kaki2) - harga(kaki1)) / harga(kaki1) > BEDA_KAKI) continue;
      let leher = arah === "naik" ? -Infinity : Infinity;
      for (let j = kaki1; j <= kaki2; j += 1) {
        leher = arah === "naik" ? Math.max(leher, b[j].tinggi) : Math.min(leher, b[j].rendah);
      }
      const dasar = Math.max(harga(kaki1), harga(kaki2));
      const puncak = Math.min(harga(kaki1), harga(kaki2));
      const cukupDalam = arah === "naik"
        ? leher >= dasar * (1 + DALAM_MIN)
        : leher <= puncak * (1 - DALAM_MIN);
      if (!cukupDalam) continue;
      // Belum tembus: tidak ada satu pun tutup sesudah kaki kedua yang
      // melewati leher.
      let sudahTembus = false;
      for (let j = kaki2 + 1; j <= i; j += 1) {
        if (arah === "naik" ? b[j].tutup > leher : b[j].tutup < leher) sudahTembus = true;
      }
      if (sudahTembus) continue;
      const ekstrem = arah === "naik"
        ? Math.min(harga(kaki1), harga(kaki2))
        : Math.max(harga(kaki1), harga(kaki2));
      return { kaki1, kaki2, leher, ekstrem };
    }
  }
  return null;
}

/* ── Daftar ─────────────────────────────────────────────────────────────── */

export const DAFTAR_SINYAL: DefinisiSinyal[] = [
  {
    id: "engulfing-naik", nama: "Bullish engulfing", arah: "naik", kelompok: "lilin", panjangStop: 2,
    keterangan: "Lilin hijau menelan badan lilin merah sebelumnya, sesudah turun.",
    deteksi: (b) => tiapIndeks(b, 6, (i) => engulfing(b, i, "naik")),
  },
  {
    id: "engulfing-turun", nama: "Bearish engulfing", arah: "turun", kelompok: "lilin", panjangStop: 2,
    keterangan: "Lilin merah menelan badan lilin hijau sebelumnya, sesudah naik.",
    deteksi: (b) => tiapIndeks(b, 6, (i) => engulfing(b, i, "turun")),
  },
  {
    id: "hammer", nama: "Hammer", arah: "naik", kelompok: "lilin", panjangStop: 1,
    keterangan: "Badan kecil di atas, ekor bawah panjang, sesudah turun.",
    deteksi: (b) => tiapIndeks(b, 5, (i) => ekorPanjang(b, i, "naik")),
  },
  {
    id: "shooting-star", nama: "Shooting star", arah: "turun", kelompok: "lilin", panjangStop: 1,
    keterangan: "Badan kecil di bawah, ekor atas panjang, sesudah naik.",
    deteksi: (b) => tiapIndeks(b, 5, (i) => ekorPanjang(b, i, "turun")),
  },
  {
    id: "morning-star", nama: "Morning star", arah: "naik", kelompok: "lilin", panjangStop: 3,
    keterangan: "Merah panjang, lilin kecil, lalu hijau menutup di atas tengah lilin pertama.",
    deteksi: (b) => tiapIndeks(b, 7, (i) => bintang(b, i, "naik")),
  },
  {
    id: "evening-star", nama: "Evening star", arah: "turun", kelompok: "lilin", panjangStop: 3,
    keterangan: "Hijau panjang, lilin kecil, lalu merah menutup di bawah tengah lilin pertama.",
    deteksi: (b) => tiapIndeks(b, 7, (i) => bintang(b, i, "turun")),
  },
  {
    id: "rsi-naik", nama: "RSI keluar dari jenuh jual", arah: "naik", kelompok: "indikator", panjangStop: 10,
    keterangan: "RSI 14 naik kembali melewati 30.",
    deteksi: (b) => {
      const r = rsi(b.map((x) => x.tutup));
      return silang((i) => (r[i] === null ? null : r[i]! >= 30), b, 15);
    },
  },
  {
    id: "rsi-turun", nama: "RSI keluar dari jenuh beli", arah: "turun", kelompok: "indikator", panjangStop: 10,
    keterangan: "RSI 14 turun kembali melewati 70.",
    deteksi: (b) => {
      const r = rsi(b.map((x) => x.tutup));
      return silang((i) => (r[i] === null ? null : r[i]! <= 70), b, 15);
    },
  },
  {
    id: "macd-naik", nama: "MACD silang naik", arah: "naik", kelompok: "indikator", panjangStop: 10,
    keterangan: "Garis MACD (12, 26) memotong garis sinyal 9 dari bawah.",
    deteksi: (b) => {
      const m = macd(b.map((x) => x.tutup));
      return silang((i) => (m.sinyal[i] === null ? null : m.garis[i]! > m.sinyal[i]!), b, 34);
    },
  },
  {
    id: "macd-turun", nama: "MACD silang turun", arah: "turun", kelompok: "indikator", panjangStop: 10,
    keterangan: "Garis MACD (12, 26) memotong garis sinyal 9 dari atas.",
    deteksi: (b) => {
      const m = macd(b.map((x) => x.tutup));
      return silang((i) => (m.sinyal[i] === null ? null : m.garis[i]! < m.sinyal[i]!), b, 34);
    },
  },
  {
    id: "golden-cross", nama: "Golden cross", arah: "naik", kelompok: "indikator", panjangStop: 10,
    keterangan: "Rata-rata 50 hari memotong rata-rata 200 hari dari bawah.",
    deteksi: (b) => {
      const t = b.map((x) => x.tutup);
      const [p, q] = [sma(t, 50), sma(t, 200)];
      return silang((i) => (q[i] === null ? null : p[i]! > q[i]!), b, 200);
    },
  },
  {
    id: "death-cross", nama: "Death cross", arah: "turun", kelompok: "indikator", panjangStop: 10,
    keterangan: "Rata-rata 50 hari memotong rata-rata 200 hari dari atas.",
    deteksi: (b) => {
      const t = b.map((x) => x.tutup);
      const [p, q] = [sma(t, 50), sma(t, 200)];
      return silang((i) => (q[i] === null ? null : p[i]! < q[i]!), b, 200);
    },
  },
  {
    id: "tembus-20", nama: "Tembus puncak 20 hari", arah: "naik", kelompok: "breakout", panjangStop: 10,
    keterangan: "Tutup di atas harga tertinggi 20 sesi sebelumnya.",
    deteksi: (b) => silang((i) => (i < 20 ? null : b[i].tutup > tertinggiSebelum(b, i, 20)), b, 21),
  },
  {
    id: "jebol-20", nama: "Jebol dasar 20 hari", arah: "turun", kelompok: "breakout", panjangStop: 10,
    keterangan: "Tutup di bawah harga terendah 20 sesi sebelumnya.",
    deteksi: (b) => silang((i) => (i < 20 ? null : b[i].tutup < terendahSebelum(b, i, 20)), b, 21),
  },
  {
    id: "puncak-52", nama: "Puncak 52 minggu", arah: "naik", kelompok: "breakout", panjangStop: 10,
    keterangan: "Tutup di atas harga tertinggi setahun terakhir.",
    deteksi: (b) => silang((i) => (i < 252 ? null : b[i].tutup > tertinggiSebelum(b, i, 252)), b, 253),
  },
  {
    id: "double-bottom", nama: "Double bottom", arah: "naik", kelompok: "pola", panjangStop: 1,
    keterangan: "Dua dasar sejajar, lalu tutup menembus puncak di antaranya.",
    titikStop: (b, i) => polaGanda(b, i, "naik")?.ekstrem ?? null,
    deteksi: (b) => tiapIndeks(b, JARAK_MIN + SAYAP + 1, (i) => polaGanda(b, i, "naik") !== null),
  },
  {
    id: "double-top", nama: "Double top", arah: "turun", kelompok: "pola", panjangStop: 1,
    keterangan: "Dua puncak sejajar, lalu tutup menembus lembah di antaranya.",
    titikStop: (b, i) => polaGanda(b, i, "turun")?.ekstrem ?? null,
    deteksi: (b) => tiapIndeks(b, JARAK_MIN + SAYAP + 1, (i) => polaGanda(b, i, "turun") !== null),
  },
  {
    id: "tembus-tren-turun", nama: "Tembus garis tren turun", arah: "naik", kelompok: "pola", panjangStop: 10,
    keterangan: "Tutup melewati garis yang menghubungkan puncak-puncak yang makin rendah.",
    deteksi: (b) => {
      const p = daftarPivot(b, "turun");
      const garis = (i: number) => garisTren(b, i, "turun", p);
      return silang((i) => {
        const g = garis(i);
        return g ? b[i].tutup > hargaGaris(g, i) : null;
      }, b, SAYAP + JENDELA_TREN);
    },
  },
  {
    id: "jebol-tren-naik", nama: "Jebol garis tren naik", arah: "turun", kelompok: "pola", panjangStop: 10,
    keterangan: "Tutup jatuh di bawah garis yang menghubungkan dasar-dasar yang makin tinggi.",
    deteksi: (b) => {
      const p = daftarPivot(b, "naik");
      const garis = (i: number) => garisTren(b, i, "naik", p);
      return silang((i) => {
        const g = garis(i);
        return g ? b[i].tutup < hargaGaris(g, i) : null;
      }, b, SAYAP + JENDELA_TREN);
    },
  },
  {
    id: "tembus-resisten", nama: "Tembus resisten mendatar", arah: "naik", kelompok: "pola", panjangStop: 10,
    keterangan: "Tutup melewati harga yang sudah tiga kali atau lebih menahan kenaikan.",
    deteksi: (b) => {
      const p = daftarPivot(b, "turun");
      return silang((i) => {
        const l = levelMendatar(b, i, "turun", p);
        // Level dicari dari harga di i-1 supaya penembusan di i tidak
        // langsung membuat levelnya dianggap sudah lewat dan hilang.
        const lSebelum = levelMendatar(b, i - 1, "turun", p);
        if (!lSebelum) return null;
        return b[i].tutup > lSebelum.harga ? true : l ? false : null;
      }, b, SAYAP + JENDELA_LEVEL);
    },
  },
  {
    id: "jebol-support", nama: "Jebol support mendatar", arah: "turun", kelompok: "pola", panjangStop: 10,
    keterangan: "Tutup jatuh di bawah harga yang sudah tiga kali atau lebih menahan penurunan.",
    deteksi: (b) => {
      const p = daftarPivot(b, "naik");
      return silang((i) => {
        const l = levelMendatar(b, i, "naik", p);
        const lSebelum = levelMendatar(b, i - 1, "naik", p);
        if (!lSebelum) return null;
        return b[i].tutup < lSebelum.harga ? true : l ? false : null;
      }, b, SAYAP + JENDELA_LEVEL);
    },
  },
  {
    id: "volume-naik", nama: "Lonjakan volume naik", arah: "naik", kelompok: "breakout", panjangStop: 10,
    keterangan: "Volume dua kali rata-rata 20 sesi, lilin hijau menutup lebih tinggi.",
    deteksi: (b) => tiapIndeks(b, 20, (i) => lonjakanVolume(b, i, "naik")),
  },
  {
    id: "volume-turun", nama: "Lonjakan volume turun", arah: "turun", kelompok: "breakout", panjangStop: 10,
    keterangan: "Volume dua kali rata-rata 20 sesi, lilin merah menutup lebih rendah.",
    deteksi: (b) => tiapIndeks(b, 20, (i) => lonjakanVolume(b, i, "turun")),
  },
];

/** Indeks kejadian yang dipakai untuk uji.
 *
 *  Kejadian yang muncul lagi sebelum jendela kejadian sebelumnya selesai
 *  dibuang. Tanpa itu, tiga hammer berturutan dihitung sebagai tiga bukti
 *  padahal ketiganya mengukur gerak harga yang sama, dan uji permutasinya
 *  jadi terlalu percaya diri. */
export function kejadianSinyal(deteksi: boolean[], jarak: number): number[] {
  const hasil: number[] = [];
  let terakhir = -Infinity;
  deteksi.forEach((ya, i) => {
    if (ya && i - terakhir >= jarak) {
      hasil.push(i);
      terakhir = i;
    }
  });
  return hasil;
}

export interface LevelSinyal {
  entry: number;
  stop: number;
  target: number;
  /** Imbalan dibagi risiko. */
  rr: number;
}

/** Entry, stop, dan target untuk sinyal yang muncul di indeks i.
 *
 *  Entry adalah tutup terakhir, harga yang bisa didapat sekarang, bukan
 *  tutup di hari polanya muncul. Stop di balik titik ekstrem pola. Target
 *  diambil dari median gerak sesudah pola yang sama di saham yang sama;
 *  median, bukan rata-rata, supaya satu lonjakan ekstrem tidak menjanjikan
 *  target yang hampir tidak pernah tercapai.
 *
 *  Null kalau median geraknya tidak searah dengan klaim pola, atau kalau
 *  harga sekarang sudah melewati stop. Keduanya berarti tidak ada rencana
 *  yang masuk akal, dan level yang dipaksakan lebih berbahaya daripada
 *  tidak ada level. */
export function levelSinyal(
  b: Lilin[], i: number, def: DefinisiSinyal, medianHasil: number | null,
): LevelSinyal | null {
  if (medianHasil === null || i < 0 || i >= b.length) return null;
  const entry = b[b.length - 1].tutup;
  let stop = def.titikStop?.(b, i) ?? null;
  if (stop === null) {
    const dari = Math.max(0, i - def.panjangStop + 1);
    stop = def.arah === "naik" ? Infinity : -Infinity;
    for (let j = dari; j <= i; j += 1) {
      stop = def.arah === "naik" ? Math.min(stop, b[j].rendah) : Math.max(stop, b[j].tinggi);
    }
  }
  if (def.arah === "naik" ? !(medianHasil > 0) || !(entry > stop) : !(medianHasil < 0) || !(entry < stop)) {
    return null;
  }
  const target = entry * (1 + medianHasil);
  const rr = Math.abs(target - entry) / Math.abs(entry - stop);
  return { entry, stop, target, rr };
}
