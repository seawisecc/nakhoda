import type { Posisi, Transaksi } from "@/types";
import { konversi, type Kurs } from "./uang";

/** Urutan kanonik transaksi: menurut tanggal kalender, lalu menurut urutan
 *  input. Dua pembelian di hari yang sama harus diproses dalam urutan yang
 *  sama setiap kali dihitung, kalau tidak biaya rata-rata bisa bergoyang. */
export function urutkanTransaksi(daftar: readonly Transaksi[]): Transaksi[] {
  return [...daftar].sort(
    (a, b) =>
      a.tanggal.localeCompare(b.tanggal) ||
      (a.dibuatPada || 0) - (b.dibuatPada || 0) ||
      a.id.localeCompare(b.id),
  );
}

/** Membangun posisi dari riwayat transaksi memakai metode biaya rata-rata.
 *
 *  Biaya rata-rata (bukan FIFO) dipilih di spec karena posisi fraksional kecil
 *  yang dibeli mencicil akan melahirkan puluhan lot FIFO yang tidak berguna
 *  untuk keputusan apa pun. Konsekuensinya: laba terealisasi memakai biaya
 *  rata-rata pada saat penjualan, bukan biaya lot tertentu.
 *
 *  Fee diperlakukan sebagai bagian dari biaya: fee beli menaikkan basis,
 *  fee jual mengurangi hasil. Jadi laba yang ditampilkan sudah bersih. */
export function bangunPosisi(
  daftar: readonly Transaksi[],
  kurs: Kurs,
): Posisi[] {
  const peta = new Map<string, Posisi>();

  for (const t of urutkanTransaksi(daftar)) {
    const kunci = t.ticker.trim().toUpperCase();
    if (!kunci || !Number.isFinite(t.qty) || !Number.isFinite(t.harga)) continue;

    let p = peta.get(kunci);
    if (!p) {
      p = {
        ticker: kunci,
        jenisAset: t.jenisAset,
        // Mata uang posisi ditetapkan oleh transaksi yang membukanya. Semua
        // transaksi berikutnya dikonversi ke sini.
        mataUang: t.mataUang,
        qty: 0,
        avgHarga: 0,
        biayaTotal: 0,
        labaTerealisasi: 0,
        feeTotal: 0,
        jumlahTransaksi: 0,
        tanggalPertama: t.tanggal,
        tanggalTerakhir: t.tanggal,
        campurMataUang: false,
      };
      peta.set(kunci, p);
    }

    if (t.mataUang !== p.mataUang) p.campurMataUang = true;

    const harga = konversi(t.harga, t.mataUang, p.mataUang, kurs);
    const fee = konversi(t.fee || 0, t.mataUang, p.mataUang, kurs);
    const qty = Math.abs(t.qty);

    p.jumlahTransaksi += 1;
    p.feeTotal += fee;
    if (t.tanggal < p.tanggalPertama) p.tanggalPertama = t.tanggal;
    if (t.tanggal > p.tanggalTerakhir) p.tanggalTerakhir = t.tanggal;

    if (t.sisi === "beli") {
      p.biayaTotal += qty * harga + fee;
      p.qty += qty;
    } else {
      // Menjual lebih banyak dari yang dipegang seharusnya dicegah di form.
      // Kalau tetap lolos, sisa yang tidak punya basis biaya diperlakukan
      // berbasis nol supaya seluruh hasilnya masuk sebagai laba, bukan
      // menghasilkan qty negatif yang merusak seluruh dashboard.
      const terjual = Math.min(qty, p.qty);
      const avgSaatIni = p.qty > 0 ? p.biayaTotal / p.qty : 0;
      p.labaTerealisasi += qty * harga - fee - terjual * avgSaatIni;
      p.biayaTotal -= terjual * avgSaatIni;
      p.qty -= terjual;
      if (p.qty <= 1e-12) {
        p.qty = 0;
        p.biayaTotal = 0;
      }
    }

    p.avgHarga = p.qty > 0 ? p.biayaTotal / p.qty : 0;
    // Transaksi terakhir menentukan klasifikasi aset, supaya salah pilih di
    // awal bisa diperbaiki hanya dengan mengedit transaksi terbaru.
    p.jenisAset = t.jenisAset;
  }

  return [...peta.values()].sort((a, b) => {
    // Posisi aktif selalu di atas posisi yang sudah ditutup.
    if ((a.qty > 0) !== (b.qty > 0)) return a.qty > 0 ? -1 : 1;
    return b.biayaTotal - a.biayaTotal || a.ticker.localeCompare(b.ticker);
  });
}

export interface HargaPasar {
  harga: number;
  mataUang: import("@/types").MataUang;
  diperbaruiPada: number;
}

/** Menempelkan harga pasar ke posisi dan menghitung laba belum terealisasi. */
export function nilaiPosisi(
  posisi: readonly Posisi[],
  harga: Readonly<Record<string, HargaPasar>>,
  kurs: Kurs,
): Posisi[] {
  return posisi.map((p) => {
    const h = harga[p.ticker];
    if (!h || !Number.isFinite(h.harga) || h.harga <= 0) return { ...p };
    const hargaLokal = konversi(h.harga, h.mataUang, p.mataUang, kurs);
    const nilaiPasar = p.qty * hargaLokal;
    const laba = nilaiPasar - p.biayaTotal;
    return {
      ...p,
      hargaTerakhir: hargaLokal,
      hargaDiperbaruiPada: h.diperbaruiPada,
      nilaiPasar,
      labaBelumTerealisasi: laba,
      // Persentase hanya bermakna kalau ada modal yang menempel. Posisi yang
      // sudah ditutup punya biaya nol, dan pembagian di situ menghasilkan
      // Infinity yang akan tampil sebagai "∞%" di kartu.
      labaBelumTerealisasiPersen: p.biayaTotal > 0 ? (laba / p.biayaTotal) * 100 : 0,
    };
  });
}
