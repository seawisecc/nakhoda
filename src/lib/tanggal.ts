/* Bantuan tanggal.
 *
 * Semua tanggal domain berbentuk string `YYYY-MM-DD`. Saat perlu dihitung,
 * string itu diurai ke tengah hari UTC, bukan tengah malam. Tengah malam UTC
 * bisa mundur satu hari begitu ditampilkan di zona waktu barat, dan tengah
 * malam lokal bisa lompat saat pergantian DST. Tengah hari aman dari keduanya.
 */

const HARI_MS = 86_400_000;

export function keTanggal(iso: string): Date {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, (b ?? 1) - 1, h ?? 1, 12, 0, 0));
}

export function keIso(d: Date): string {
  const t = d.getUTCFullYear();
  const b = String(d.getUTCMonth() + 1).padStart(2, "0");
  const h = String(d.getUTCDate()).padStart(2, "0");
  return `${t}-${b}-${h}`;
}

/** Tanggal hari ini menurut jam dinding pengguna, bukan menurut UTC. */
export function hariIni(): string {
  const d = new Date();
  const t = d.getFullYear();
  const b = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getDate()).padStart(2, "0");
  return `${t}-${b}-${h}`;
}

export function hariAntara(dari: string, sampai: string): number {
  return Math.round((keTanggal(sampai).getTime() - keTanggal(dari).getTime()) / HARI_MS);
}

export function tambahHari(iso: string, n: number): string {
  return keIso(new Date(keTanggal(iso).getTime() + n * HARI_MS));
}

/** "2026-09-14" -> "2026-09-01" */
export function awalBulan(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "2026-09-14" -> "2026-09-30" */
export function akhirBulan(iso: string): string {
  const d = keTanggal(iso);
  return keIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
}

/** "2026-09" */
export function kunciBulan(iso: string): string {
  return iso.slice(0, 7);
}

export function bulanSebelumnya(kunci: string): string {
  const [t, b] = kunci.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 2, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export function formatTanggal(iso: string, gaya: "panjang" | "pendek" = "pendek"): string {
  if (!iso) return "";
  const d = keTanggal(iso);
  const nama = gaya === "panjang" ? NAMA_BULAN : NAMA_BULAN_PENDEK;
  return `${d.getUTCDate()} ${nama[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatBulan(kunci: string): string {
  const [t, b] = kunci.split("-").map(Number);
  return `${NAMA_BULAN[b - 1]} ${t}`;
}

/** "3 menit lalu". Dipakai untuk menandai umur harga yang di-cache. */
export function selangWaktu(epochMs: number, sekarang = Date.now()): string {
  const detik = Math.max(0, Math.round((sekarang - epochMs) / 1000));
  if (detik < 45) return "baru saja";
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return `${Math.round(hari / 30)} bulan lalu`;
}
