import type { MataUang } from "@/types";

/* Format angka gaya Indonesia: titik untuk ribuan, koma untuk desimal. */

export function formatUang(
  jumlah: number,
  mataUang: MataUang,
  opsi: { ringkas?: boolean; desimal?: number } = {},
): string {
  if (!Number.isFinite(jumlah)) return "—";
  const { ringkas = false, desimal } = opsi;

  // Tanda minus ditempatkan sebelum simbol mata uang, bukan setelahnya.
  // "Rp -126.000" terbaca seperti salah ketik; "-Rp 126.000" terbaca sebagai
  // nominal negatif.
  const tanda = jumlah < 0 ? "-" : "";
  const abs = Math.abs(jumlah);

  if (ringkas) {
    const nilai = ringkasNominal(abs, mataUang);
    if (nilai) return `${tanda}${simbol(mataUang)}${nilai}`;
  }

  // IDR tidak pernah butuh sen; USD butuh, kecuali angkanya besar sekali.
  const d = desimal ?? (mataUang === "IDR" ? 0 : abs >= 10_000 ? 0 : 2);
  return `${tanda}${simbol(mataUang)}${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(abs)}`;
}

export function simbol(mataUang: MataUang): string {
  return mataUang === "IDR" ? "Rp " : "$";
}

/** "128,4 jt". Menerima nilai mutlak; tandanya diurus pemanggil.
 *  Hanya untuk kartu ringkasan sempit, tidak untuk tabel. */
function ringkasNominal(abs: number, mataUang: MataUang): string | null {
  const p = (n: number, d = 1) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(n);

  if (mataUang === "IDR") {
    if (abs >= 1e12) return `${p(abs / 1e12, 2)} T`;
    if (abs >= 1e9) return `${p(abs / 1e9, 2)} M`;
    if (abs >= 1e6) return `${p(abs / 1e6)} jt`;
    if (abs >= 1e3) return `${p(abs / 1e3)} rb`;
    return null;
  }
  if (abs >= 1e9) return `${p(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${p(abs / 1e6, 2)}M`;
  if (abs >= 1e4) return `${p(abs / 1e3)}K`;
  return null;
}

/** Jumlah unit. Saham fraksional butuh desimal, kripto butuh lebih banyak. */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "—";
  const abs = Math.abs(qty);
  const d = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(qty);
}

export function formatPersen(nilai: number, desimal = 2, denganTanda = true): string {
  if (!Number.isFinite(nilai)) return "—";
  const s = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(nilai);
  const tanda = denganTanda && nilai > 0 ? "+" : "";
  return `${tanda}${s}%`;
}

/** Angka polos tanpa simbol mata uang, untuk kolom tabel yang sudah berjudul. */
export function formatAngka(nilai: number, desimal = 2): string {
  if (!Number.isFinite(nilai)) return "—";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(nilai);
}

/** Membaca angka yang diketik pengguna Indonesia: "1.250,5" maupun "1250.5". */
export function bacaAngka(teks: string): number {
  const bersih = teks.trim().replace(/\s/g, "");
  if (!bersih) return NaN;
  const adaKoma = bersih.includes(",");
  const adaTitik = bersih.includes(".");
  let normal = bersih;
  if (adaKoma && adaTitik) {
    // Yang muncul belakangan adalah pemisah desimal.
    normal =
      bersih.lastIndexOf(",") > bersih.lastIndexOf(".")
        ? bersih.replace(/\./g, "").replace(",", ".")
        : bersih.replace(/,/g, "");
  } else if (adaKoma) {
    normal = bersih.replace(",", ".");
  } else if (adaTitik) {
    // Titik tunggal ambigu. "1.250" hampir pasti ribuan, "1.25" hampir pasti
    // desimal. Pemisah ribuan selalu meninggalkan tepat tiga digit di belakang.
    const bagian = bersih.split(".");
    const ribuan = bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3);
    normal = ribuan ? bersih.replace(/\./g, "") : bersih;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

export function tandaArah(nilai: number): "▲" | "▼" | "—" {
  if (nilai > 0) return "▲";
  if (nilai < 0) return "▼";
  return "—";
}
