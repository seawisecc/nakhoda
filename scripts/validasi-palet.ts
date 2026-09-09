/* Validator palet.
 *
 * CLAUDE.md melarang menebak warna chart, dan mensyaratkan gate ini dijalankan
 * sebelum palet seri diubah. Sebelumnya gate itu hanya ada sebagai catatan di
 * globals.css, tanpa cara memeriksanya ulang; jadi setiap perubahan warna
 * bertumpu pada keyakinan bahwa nilai lamanya masih berlaku di permukaan yang
 * baru. Skrip ini yang mengubahnya jadi bisa diperiksa.
 *
 * Yang diuji:
 *   1. Kontras teks terhadap SEMUA permukaan tempat teks itu benar-benar
 *      dipakai, bukan hanya terhadap --nk-surface. Label kecil paling sering
 *      duduk di atas --nk-surface-2, permukaan paling terang di tema gelap,
 *      dan di situlah nilai yang lolos di surface biasa mulai jatuh.
 *   2. Kontras warna seri terhadap permukaannya (ambang 3:1, karena seri
 *      dipakai sebagai bidang dan garis, bukan sebagai teks).
 *   3. Pemisahan antar seri untuk SEMUA pasangan, di penglihatan normal dan
 *      di simulasi protanopia serta deuteranopia. Menguji pasangan yang
 *      bersebelahan saja tidak cukup: seri 1 dan 3 bisa bertabrakan meski
 *      keduanya aman terhadap seri 2.
 *
 * Jalankan: npx tsx scripts/validasi-palet.ts
 */

/* ── Ruang warna ────────────────────────────────────────────────────── */

type Rgb = [number, number, number];
type Lab = [number, number, number];

function uraiHex(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const p = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(p.slice(0, 2), 16) / 255,
    parseInt(p.slice(2, 4), 16) / 255,
    parseInt(p.slice(4, 6), 16) / 255,
  ];
}

/** sRGB berkode gamma ke linear. Semua perhitungan warna di bawah bekerja di
 *  ruang linear; mencampur nilai bergamma adalah sumber kesalahan paling umum
 *  saat menghitung kontras. */
function keLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function keSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

function luminansi(hex: string): number {
  const [r, g, b] = uraiHex(hex).map(keLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kontras(depan: string, belakang: string): number {
  const a = luminansi(depan);
  const b = luminansi(belakang);
  const [terang, gelap] = a > b ? [a, b] : [b, a];
  return (terang + 0.05) / (gelap + 0.05);
}

/** Lab D65. Dipakai untuk jarak warna, bukan untuk kontras: kontras WCAG
 *  hanya melihat luminansi, jadi dua warna dengan kontras sama terhadap latar
 *  masih bisa mustahil dibedakan satu sama lain. */
function keLab(hex: string): Lab {
  const [r, g, b] = uraiHex(hex).map(keLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = keLab(a);
  const [l2, a2, b2] = keLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Simulasi buta warna dikotomat, matriks Vienot-Brettel-Mollon (1999),
 *  diterapkan di ruang linear. Ini pendekatan, bukan pengalaman sebenarnya
 *  seseorang, tapi cukup untuk menolak pasangan warna yang jelas melebur. */
const MATRIKS = {
  protan: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
  deutan: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1],
} as const;

function simulasi(hex: string, jenis: keyof typeof MATRIKS): string {
  const [r, g, b] = uraiHex(hex).map(keLinear);
  const m = MATRIKS[jenis];
  const keluar = [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ].map((v) => Math.round(keSrgb(Math.max(0, v)) * 255));
  return "#" + keluar.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/* ── Ambang ─────────────────────────────────────────────────────────── */

const AMBANG = {
  /** WCAG AA untuk teks berukuran normal. */
  teks: 4.5,
  /** WCAG AA untuk komponen non-teks: bidang seri, garis chart, batas isian. */
  bidang: 3,
  /** Jarak antar seri di penglihatan normal. */
  pisahNormal: 19.5,
  /** Jarak antar seri di simulasi dikotomat. Nilai ini yang paling sering
   *  gagal, dan yang paling sering tidak diperiksa. */
  pisahButaWarna: 8,
} as const;

/* ── Palet yang diuji ───────────────────────────────────────────────── */

type Tema = {
  nama: string;
  permukaan: Record<string, string>;
  /** Teks: warna, lalu daftar nama permukaan tempat dia dipakai. */
  teks: Record<string, { warna: string; di: string[] }>;
  seri: string[];
  /** Batas kontrol: tepi isian, select, tombol berbingkai. Ini yang tunduk ke
   *  3:1, karena tanpa tepinya kontrolnya tidak bisa dikenali. */
  batasKontrol: Record<string, { warna: string; di: string[] }>;
  /** Garis dekoratif: pemisah baris tabel, tepi kartu. Tidak diberi ambang,
   *  dan itu bukan kelonggaran: WCAG 1.4.11 mengikat komponen yang harus
   *  dikenali, bukan garis pemisah. Memaksa hairline ke 3:1 di atas kertas
   *  menghasilkan jala garis gelap di seluruh layar, dan yang hilang justru
   *  keterbacaannya. Nilainya tetap dicetak supaya tidak lolos tanpa dilihat. */
  garis: Record<string, { warna: string; di: string[] }>;
};

const TEMA: Tema[] = [
  {
    nama: "terang (kertas)",
    permukaan: {
      canvas: "#e7e4dc",
      surface: "#f6f4ef",
      "surface-2": "#edeae3",
      "surface-sunk": "#dedbd2",
    },
    teks: {
      ink: { warna: "#14120f", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      "ink-soft": { warna: "#4c4840", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      "ink-faint": { warna: "#635e52", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      aksen: { warna: "#a8231d", di: ["surface", "surface-2", "canvas"] },
      naik: { warna: "#0f6b45", di: ["surface", "surface-2", "canvas"] },
      turun: { warna: "#a8231d", di: ["surface", "surface-2", "canvas"] },
      peringatan: { warna: "#7d5310", di: ["surface", "surface-2", "canvas"] },
      info: { warna: "#1d5570", di: ["surface", "surface-2", "canvas"] },
      netral: { warna: "#635e52", di: ["surface", "surface-2", "canvas"] },
    },
    seri: ["#9e6b06", "#2a6fce", "#0f8259"],
    batasKontrol: {
      "border-strong": { warna: "#787365", di: ["surface", "surface-2", "surface-sunk"] },
    },
    garis: {
      border: { warna: "#cdc9bc", di: ["surface", "canvas"] },
    },
  },
  {
    nama: "gelap (terminal)",
    permukaan: {
      canvas: "#0a0a09",
      surface: "#131312",
      "surface-2": "#1e1e1c",
      "surface-sunk": "#0a0a09",
    },
    teks: {
      ink: { warna: "#eceae4", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      "ink-soft": { warna: "#b2afa6", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      "ink-faint": { warna: "#8d8a81", di: ["surface", "surface-2", "canvas", "surface-sunk"] },
      aksen: { warna: "#ff6250", di: ["surface", "surface-2", "canvas"] },
      naik: { warna: "#3fd68d", di: ["surface", "surface-2", "canvas"] },
      turun: { warna: "#ff6250", di: ["surface", "surface-2", "canvas"] },
      peringatan: { warna: "#e8b752", di: ["surface", "surface-2", "canvas"] },
      info: { warna: "#79bde0", di: ["surface", "surface-2", "canvas"] },
      netral: { warna: "#8d8a81", di: ["surface", "surface-2", "canvas"] },
    },
    seri: ["#c98500", "#3987e5", "#199e70"],
    batasKontrol: {
      "border-strong": { warna: "#6e6c62", di: ["surface", "surface-2", "surface-sunk"] },
    },
    garis: {
      border: { warna: "#2d2d2a", di: ["surface", "canvas"] },
    },
  },
];

/* ── Jalan ──────────────────────────────────────────────────────────── */

let gagal = 0;

function lapor(lolos: boolean, baris: string) {
  if (!lolos) gagal++;
  console.log(`${lolos ? "  ok " : "GAGAL"}  ${baris}`);
}

function angka(n: number, digit = 2) {
  return n.toFixed(digit).replace(".", ",");
}

for (const tema of TEMA) {
  console.log(`\n── ${tema.nama} ${"─".repeat(Math.max(0, 56 - tema.nama.length))}`);

  console.log("\n  kontras teks (ambang 4,5:1)");
  for (const [nama, { warna, di }] of Object.entries(tema.teks)) {
    for (const permukaan of di) {
      const r = kontras(warna, tema.permukaan[permukaan]);
      lapor(r >= AMBANG.teks, `${nama} di ${permukaan}: ${angka(r)}:1`);
    }
  }

  console.log("\n  kontras batas kontrol (ambang 3:1)");
  for (const [nama, { warna, di }] of Object.entries(tema.batasKontrol)) {
    for (const permukaan of di) {
      const r = kontras(warna, tema.permukaan[permukaan]);
      lapor(r >= AMBANG.bidang, `${nama} di ${permukaan}: ${angka(r)}:1`);
    }
  }

  console.log("\n  garis dekoratif (tanpa ambang, lihat catatan di tipe Tema)");
  for (const [nama, { warna, di }] of Object.entries(tema.garis)) {
    for (const permukaan of di) {
      const r = kontras(warna, tema.permukaan[permukaan]);
      console.log(`  info   ${nama} di ${permukaan}: ${angka(r)}:1`);
    }
  }

  console.log("\n  kontras seri terhadap permukaan (ambang 3:1)");
  tema.seri.forEach((warna, i) => {
    for (const permukaan of ["surface", "surface-2", "canvas"]) {
      const r = kontras(warna, tema.permukaan[permukaan]);
      lapor(r >= AMBANG.bidang, `seri-${i + 1} di ${permukaan}: ${angka(r)}:1`);
    }
  });

  console.log("\n  pemisahan antar seri, semua pasangan");
  for (let i = 0; i < tema.seri.length; i++) {
    for (let j = i + 1; j < tema.seri.length; j++) {
      const a = tema.seri[i];
      const b = tema.seri[j];
      const normal = deltaE(a, b);
      const protan = deltaE(simulasi(a, "protan"), simulasi(b, "protan"));
      const deutan = deltaE(simulasi(a, "deutan"), simulasi(b, "deutan"));
      const pasangan = `seri-${i + 1} vs seri-${j + 1}`;
      lapor(normal >= AMBANG.pisahNormal, `${pasangan} normal: dE ${angka(normal, 1)}`);
      lapor(protan >= AMBANG.pisahButaWarna, `${pasangan} protan: dE ${angka(protan, 1)}`);
      lapor(deutan >= AMBANG.pisahButaWarna, `${pasangan} deutan: dE ${angka(deutan, 1)}`);
    }
  }

  console.log("\n  pemisahan naik vs turun, semua pasangan");
  {
    const naik = tema.teks.naik.warna;
    const turun = tema.teks.turun.warna;
    for (const jenis of ["protan", "deutan"] as const) {
      const d = deltaE(simulasi(naik, jenis), simulasi(turun, jenis));
      // Naik dan turun BOLEH melebur di simulasi buta warna, karena arah di
      // Nakhoda tidak pernah dibawa oleh warna saja; selalu ada tanda / kata.
      // Angkanya tetap dicetak supaya keputusan itu tetap terlihat, bukan
      // diam-diam diandalkan.
      console.log(`  info   naik vs turun ${jenis}: dE ${angka(d, 1)} (tidak diberi ambang, arah dibawa tanda)`);
    }
  }
}

console.log(
  gagal === 0
    ? "\nSemua gate lolos.\n"
    : `\n${gagal} gate GAGAL. Palet tidak boleh dipakai apa adanya.\n`,
);

process.exit(gagal === 0 ? 0 : 1);
