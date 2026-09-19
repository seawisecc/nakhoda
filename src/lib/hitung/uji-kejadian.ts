import { formatPersen } from "@/lib/format";

/* Uji kejadian: apakah return sesudah suatu tanda berbeda dari return pada
 * hari biasa di saham yang sama.
 *
 * Dipakai bersama oleh aspek planet dan pola chart. Satu mesin untuk
 * keduanya disengaja: kalau astro dan pola lilin dinilai dengan ukuran yang
 * berbeda, hasilnya tidak bisa dibandingkan, dan yang lebih longgar akan
 * selalu tampak lebih "berhasil".
 */

export interface BatangHarian {
  /** Tanggal sesi, "YYYY-MM-DD". */
  tanggal: string;
  tutup: number;
}

export interface ReturnKejadian {
  /** Tanggal sesi yang tutupnya dipakai sebagai titik awal. */
  tanggalMasuk: string;
  tanggalKeluar: string;
  /** Pecahan, 0,05 berarti 5%. */
  hasil: number;
}

export interface HasilUji<K extends ReturnKejadian = ReturnKejadian> {
  horizon: number;
  kejadian: K[];
  /** Kejadian yang jatuh sebelum data mulai atau yang jendelanya belum selesai. */
  terlewat: number;
  rataRata: number | null;
  median: number | null;
  persenNaik: number | null;
  /** Return h sesi dari setiap titik awal yang mungkin di data yang sama. */
  dasar: { n: number; rataRata: number; persenNaik: number } | null;
  /** Porsi sampel acak berukuran sama yang menyimpang dari dasar sejauh ini
   *  atau lebih. Kecil berarti sulit dijelaskan sebagai kebetulan. */
  peluangKebetulan: number | null;
  /** Di bawah lima kejadian, angka apa pun di atas cuma anekdot. */
  terlaluSedikit: boolean;
}

export const MIN_KEJADIAN = 5;

/** Generator acak berbenih (mulberry32). Tanpa benih, "peluang kebetulan"
 *  akan berubah setiap render dan angka yang berubah sendiri tidak bisa
 *  dipercaya maupun diuji. */
function acakBerbenih(benih: number) {
  let s = benih >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(x: number[]): number {
  const s = [...x].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Return h sesi dari setiap indeks masuk, dibandingkan dengan return h sesi
 *  dari titik mana pun di data yang sama.
 *
 *  Pembanding sengaja bukan nol. Saham yang naik 20% setahun punya return
 *  lima hari rata-rata positif di tanggal apa pun; sebuah tanda baru berarti
 *  kalau return sesudahnya berbeda dari itu.
 *
 *  Harganya harga tutup yang sudah disesuaikan split. Return adalah rasio,
 *  jadi mata uangnya tidak berpengaruh selama seluruh deret dalam satu mata
 *  uang, dan route riwayat selalu membalas dalam USD. */
export function ujiDariIndeks(
  batang: BatangHarian[], indeksMasuk: number[], horizon: number,
  opsi: { sampel?: number; benih?: number } = {},
): HasilUji {
  const h = Math.max(1, Math.floor(horizon));
  const kejadian: ReturnKejadian[] = [];
  let terlewat = 0;

  for (const iMasuk of indeksMasuk) {
    const iKeluar = iMasuk + h;
    if (iMasuk < 0 || iKeluar >= batang.length || !(batang[iMasuk].tutup > 0)) {
      terlewat += 1;
      continue;
    }
    kejadian.push({
      tanggalMasuk: batang[iMasuk].tanggal,
      tanggalKeluar: batang[iKeluar].tanggal,
      hasil: batang[iKeluar].tutup / batang[iMasuk].tutup - 1,
    });
  }

  const semua: number[] = [];
  for (let i = 0; i + h < batang.length; i += 1) {
    if (batang[i].tutup > 0) semua.push(batang[i + h].tutup / batang[i].tutup - 1);
  }
  const dasar = semua.length
    ? {
      n: semua.length,
      rataRata: semua.reduce((s, x) => s + x, 0) / semua.length,
      persenNaik: (semua.filter((x) => x > 0).length / semua.length) * 100,
    }
    : null;

  const n = kejadian.length;
  if (!n) {
    return {
      horizon: h, kejadian, terlewat, rataRata: null, median: null, persenNaik: null,
      dasar, peluangKebetulan: null, terlaluSedikit: true,
    };
  }

  const hasil = kejadian.map((k) => k.hasil);
  const rataRata = hasil.reduce((s, x) => s + x, 0) / n;

  // Uji permutasi: ambil n titik acak dari data yang sama berulang kali, lalu
  // hitung seberapa sering rata-ratanya menyimpang dari dasar sejauh rata-rata
  // kejadian. Dipilih ketimbang uji-t karena return harian berekor gemuk dan n
  // di sini kecil, dua hal yang membuat uji-t terlalu percaya diri.
  let peluangKebetulan: number | null = null;
  if (dasar && semua.length > n) {
    const sampel = opsi.sampel ?? 2000;
    const acak = acakBerbenih(opsi.benih ?? 1);
    // Dikurangi toleransi kecil supaya derau floating point (selisih 1e-17
    // antara dua rasio yang secara matematis sama) tidak dihitung sebagai
    // simpangan yang lebih kecil dari simpangan acak.
    const simpang = Math.abs(rataRata - dasar.rataRata) - 1e-12;
    let sama = 0;
    for (let s = 0; s < sampel; s += 1) {
      let jumlah = 0;
      for (let k = 0; k < n; k += 1) jumlah += semua[Math.floor(acak() * semua.length)];
      if (Math.abs(jumlah / n - dasar.rataRata) >= simpang) sama += 1;
    }
    peluangKebetulan = sama / sampel;
  }

  return {
    horizon: h,
    kejadian,
    terlewat,
    rataRata,
    median: median(hasil),
    persenNaik: (hasil.filter((x) => x > 0).length / n) * 100,
    dasar,
    peluangKebetulan,
    terlaluSedikit: n < MIN_KEJADIAN,
  };
}

/* ── Kesimpulan ─────────────────────────────────────────────────────────── */

export type Tingkat = "catatan" | "lemah" | "acak" | "jarang";

export type Arah = "naik" | "turun";

export interface Penilaian {
  tingkat: Tingkat;
  /** Apakah simpangannya ke arah yang diklaim tandanya. Null kalau tandanya
   *  tidak mengklaim arah (aspek planet) atau tidak ada simpangan berarti. */
  searah: boolean | null;
}

export const NAMA_TINGKAT: Record<Tingkat, string> = {
  catatan: "Punya catatan",
  lemah: "Petunjuk lemah",
  acak: "Seperti acak",
  jarang: "Terlalu jarang",
};

/** Menerjemahkan angka uji jadi satu tingkat yang bisa dibaca tanpa statistik.
 *
 *  "Punya catatan" memakai koreksi Bonferroni: batas 5% dibagi jumlah tanda
 *  yang diuji sekaligus di layar yang sama. Tanpa koreksi itu, dari 16 pola
 *  hampir pasti ada satu yang lolos 5% murni karena kebetulan, dan app akan
 *  menyorotnya dengan yakin setiap hari. Yang lolos 5% tapi tidak lolos
 *  koreksi disebut "petunjuk lemah", bukan disembunyikan, supaya pemiliknya
 *  tetap bisa melihatnya tanpa dibujuk untuk memercayainya. */
export function nilaiUji(hasil: HasilUji, jumlahUji: number, arah?: Arah): Penilaian {
  if (hasil.terlaluSedikit || hasil.peluangKebetulan === null || hasil.rataRata === null || !hasil.dasar) {
    return { tingkat: "jarang", searah: null };
  }
  const p = hasil.peluangKebetulan;
  const tingkat: Tingkat = p < 0.05 / Math.max(1, jumlahUji) ? "catatan" : p < 0.05 ? "lemah" : "acak";
  if (tingkat === "acak" || !arah) return { tingkat, searah: null };
  const lebihTinggi = hasil.rataRata > hasil.dasar.rataRata;
  return { tingkat, searah: arah === "naik" ? lebihTinggi : !lebihTinggi };
}

const persen = (x: number) => formatPersen(x * 100, 1);

/** Satu kalimat kesimpulan, dimulai dengan apa yang sebaiknya dilakukan. */
export function kalimatKesimpulan(
  nama: string, ticker: string, hasil: HasilUji, nilai: Penilaian, arah?: Arah,
): string {
  const n = hasil.kejadian.length;
  const h = hasil.horizon;
  if (nilai.tingkat === "jarang" || hasil.rataRata === null || !hasil.dasar) {
    return n
      ? `Belum bisa disimpulkan. ${nama} baru muncul ${n} kali di ${ticker}, terlalu sedikit untuk dibedakan dari kebetulan.`
      : `Belum bisa disimpulkan. ${nama} belum pernah muncul di data ${ticker}.`;
  }
  const naik = Math.round(((hasil.persenNaik ?? 0) / 100) * n);
  const angka = `${h} sesi sesudahnya rata-rata ${persen(hasil.rataRata)}, hari biasa ${persen(hasil.dasar.rataRata)}`;
  if (nilai.tingkat === "acak") {
    return `Abaikan. ${nama} muncul ${n} kali di ${ticker} dan hasilnya tidak beda dari hari biasa: ${angka}.`;
  }
  const lemah = nilai.tingkat === "lemah";
  const pembuka = lemah ? "Petunjuk lemah, belum cukup untuk bertindak." : "Punya catatan.";
  if (nilai.searah === false && arah) {
    return `${pembuka} Tanda ${arah} ini justru diikuti gerak sebaliknya di ${ticker}: ${angka}, dari ${n} kejadian.`;
  }
  return `${pembuka} Sesudah ${nama}, ${ticker} naik ${naik} dari ${n} kali; ${angka}.`;
}
