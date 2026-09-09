import type { JenisAset, Pengaturan } from "@/types";

/* Biaya transaksi.
 *
 * Nakhoda tidak tahu tarif broker siapa pun, dan tidak berpura-pura tahu.
 * Tarif disimpan di Pengaturan sebagai angka yang bisa diubah, dan nilai
 * awalnya jelas ditandai sebagai perkiraan yang harus diperiksa.
 *
 * Alasannya bukan kehati-hatian berlebihan: fee masuk ke basis biaya, jadi
 * tarif yang meleset 0,2% akan menggeser setiap angka laba di seluruh app,
 * pelan-pelan, tanpa pernah terlihat sebagai kesalahan.
 */

export function tarifUntuk(jenisAset: JenisAset, p: Pengaturan): number {
  const tarif = jenisAset === "kripto" ? p.feePersenKripto : p.feePersenSaham;
  return Number.isFinite(tarif) && tarif >= 0 ? tarif : 0;
}

/** Biaya untuk satu transaksi bernilai `nilai`, dalam mata uang yang sama. */
export function hitungBiaya(nilai: number, jenisAset: JenisAset, p: Pengaturan): number {
  if (!Number.isFinite(nilai) || nilai <= 0) return 0;
  return (nilai * tarifUntuk(jenisAset, p)) / 100;
}

/** Menurunkan tarif sebenarnya dari satu transaksi yang sudah terjadi.
 *
 *  Dipakai di Pengaturan: masukkan nilai kotor transaksi dan uang yang
 *  benar-benar berpindah, dan tarifnya jatuh sendiri. Jauh lebih dapat
 *  dipercaya daripada tarif yang ditebak, karena angkanya datang dari
 *  rekening sendiri.
 *
 *  Untuk pembelian, `nyata` adalah uang yang keluar (lebih besar dari kotor).
 *  Untuk penjualan, `nyata` adalah uang yang masuk (lebih kecil dari kotor). */
export function turunkanTarif(kotor: number, nyata: number): number | null {
  if (!Number.isFinite(kotor) || !Number.isFinite(nyata) || kotor <= 0 || nyata <= 0) {
    return null;
  }
  const selisih = Math.abs(nyata - kotor);
  const tarif = (selisih / kotor) * 100;
  // Di atas 10% hampir pasti bukan biaya transaksi melainkan salah input,
  // misalnya nilai kotor dan bersih tertukar mata uangnya.
  return tarif > 10 ? null : tarif;
}
