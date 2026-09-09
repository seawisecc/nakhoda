import type {
  ArusModal,
  JurnalEntri,
  MataUang,
  Posisi,
  Snapshot,
  Transaksi,
} from "@/types";
import { konversi, type Kurs } from "./uang";
import { awalBulan, hariAntara, hariIni } from "@/lib/tanggal";

export interface RingkasanPortofolio {
  mataUang: MataUang;
  /** Nilai pasar seluruh posisi terbuka. Posisi tanpa harga dinilai sebesar
   *  biaya perolehannya, supaya total tidak tiba-tiba anjlok hanya karena
   *  satu ticker gagal diambil harganya. */
  nilaiPosisi: number;
  /** Uang menganggur: modal yang sudah masuk tapi belum dibelikan aset. */
  kas: number;
  totalNilai: number;
  /** Setoran dikurangi penarikan. Ini "uang saya sendiri" yang ada di dalam. */
  modalBersih: number;
  totalSetor: number;
  totalTarik: number;
  labaBelumTerealisasi: number;
  labaTerealisasi: number;
  labaTotal: number;
  labaTotalPersen: number;
  alokasi: { saham: number; kripto: number; kas: number };
  /** Berapa posisi yang harganya belum sempat diambil. */
  posisiTanpaHarga: number;
}

/** Menjumlahkan semua arus modal sampai tanggal tertentu, dalam mata uang dasar. */
function arusBersihSampai(
  arus: readonly ArusModal[],
  sampai: string | null,
  dasar: MataUang,
  kurs: Kurs,
): { bersih: number; setor: number; tarik: number } {
  let setor = 0;
  let tarik = 0;
  for (const a of arus) {
    if (sampai && a.tanggal > sampai) continue;
    const nilai = konversi(Math.abs(a.jumlah), a.mataUang, dasar, kurs);
    if (a.tipe === "tarik") tarik += nilai;
    else setor += nilai;
  }
  return { bersih: setor - tarik, setor, tarik };
}

/** Kas = modal masuk − uang dipakai beli + hasil jual bersih. */
function kasSampai(
  transaksi: readonly Transaksi[],
  arus: readonly ArusModal[],
  sampai: string | null,
  dasar: MataUang,
  kurs: Kurs,
): number {
  let kas = arusBersihSampai(arus, sampai, dasar, kurs).bersih;
  for (const t of transaksi) {
    if (sampai && t.tanggal > sampai) continue;
    const nilai = konversi(Math.abs(t.qty) * t.harga, t.mataUang, dasar, kurs);
    const fee = konversi(t.fee || 0, t.mataUang, dasar, kurs);
    kas += t.sisi === "beli" ? -(nilai + fee) : nilai - fee;
  }
  return kas;
}

export function ringkasPortofolio(
  posisi: readonly Posisi[],
  transaksi: readonly Transaksi[],
  arus: readonly ArusModal[],
  dasar: MataUang,
  kurs: Kurs,
): RingkasanPortofolio {
  let nilaiPosisi = 0;
  let labaBelum = 0;
  let labaTerealisasi = 0;
  let posisiTanpaHarga = 0;
  const alokasi = { saham: 0, kripto: 0, kas: 0 };

  for (const p of posisi) {
    labaTerealisasi += konversi(p.labaTerealisasi, p.mataUang, dasar, kurs);
    if (p.qty <= 0) continue;
    const punyaHarga = p.nilaiPasar !== undefined;
    if (!punyaHarga) posisiTanpaHarga += 1;
    const nilai = konversi(p.nilaiPasar ?? p.biayaTotal, p.mataUang, dasar, kurs);
    nilaiPosisi += nilai;
    if (punyaHarga) labaBelum += konversi(p.labaBelumTerealisasi ?? 0, p.mataUang, dasar, kurs);
    alokasi[p.jenisAset === "kripto" ? "kripto" : "saham"] += nilai;
  }

  const kas = kasSampai(transaksi, arus, null, dasar, kurs);
  alokasi.kas = Math.max(0, kas);

  const { bersih: modalBersih, setor, tarik } = arusBersihSampai(arus, null, dasar, kurs);
  const totalNilai = nilaiPosisi + kas;
  const labaTotal = totalNilai - modalBersih;

  return {
    mataUang: dasar,
    nilaiPosisi,
    kas,
    totalNilai,
    modalBersih,
    totalSetor: setor,
    totalTarik: tarik,
    labaBelumTerealisasi: labaBelum,
    labaTerealisasi,
    labaTotal,
    labaTotalPersen: modalBersih > 0 ? (labaTotal / modalBersih) * 100 : 0,
    alokasi,
    posisiTanpaHarga,
  };
}

/** Nilai buku portofolio pada suatu tanggal.
 *
 *  Identitas yang dipakai: kas + biaya perolehan posisi = arus modal bersih +
 *  laba terealisasi. Ruas kanan hanya butuh riwayat transaksi, tidak butuh
 *  harga pasar historis, jadi bisa dihitung untuk tanggal kapan pun.
 *  Ini dipakai sebagai BMV cadangan ketika belum ada snapshot. Angkanya
 *  meremehkan portofolio yang sedang untung, karena posisi dinilai sebesar
 *  modalnya, bukan sebesar harganya. Karena itu hasilnya selalu ditandai
 *  "perkiraan" di UI. */
export function nilaiBukuPada(
  transaksi: readonly Transaksi[],
  arus: readonly ArusModal[],
  tanggal: string,
  dasar: MataUang,
  kurs: Kurs,
): number {
  const sampai = transaksi.filter((t) => t.tanggal <= tanggal);
  let realisasi = 0;
  const basis = new Map<string, { qty: number; biaya: number }>();
  for (const t of [...sampai].sort(
    (a, b) => a.tanggal.localeCompare(b.tanggal) || (a.dibuatPada || 0) - (b.dibuatPada || 0),
  )) {
    const k = t.ticker.toUpperCase();
    const b = basis.get(k) ?? { qty: 0, biaya: 0 };
    const nilai = konversi(Math.abs(t.qty) * t.harga, t.mataUang, dasar, kurs);
    const fee = konversi(t.fee || 0, t.mataUang, dasar, kurs);
    if (t.sisi === "beli") {
      b.qty += Math.abs(t.qty);
      b.biaya += nilai + fee;
    } else {
      const terjual = Math.min(Math.abs(t.qty), b.qty);
      const avg = b.qty > 0 ? b.biaya / b.qty : 0;
      realisasi += nilai - fee - terjual * avg;
      b.biaya -= terjual * avg;
      b.qty -= terjual;
    }
    basis.set(k, b);
  }
  return arusBersihSampai(arus, tanggal, dasar, kurs).bersih + realisasi;
}

export interface HasilDietz {
  /** Return periode dalam persen, atau null kalau tidak terdefinisi. */
  persen: number | null;
  bmv: number;
  emv: number;
  arusBersih: number;
  /** Penyebut Modified Dietz: modal rata-rata tertimbang selama periode. */
  modalRata: number;
  /** Benar kalau BMV berasal dari nilai buku, bukan dari snapshot nyata. */
  bmvPerkiraan: boolean;
  mulai: string;
  akhir: string;
  hari: number;
  alasanKosong?: string;
}

/** Modified Dietz.
 *
 *      R = (EMV − BMV − CF) / (BMV + Σ CF_i × (1 − t_i / T))
 *
 *  Setiap setoran diberi bobot sesuai berapa lama uang itu sempat bekerja di
 *  dalam periode. Uang yang masuk di hari terakhir bulan dapat bobot nol: dia
 *  menaikkan nilai portofolio tapi tidak pernah punya kesempatan menghasilkan
 *  apa pun, jadi dia tidak boleh ikut menjadi penyebut yang menekan return.
 *
 *  Inilah bedanya dengan (EMV−BMV)/BMV yang naif: dengan rumus naif, setor
 *  10 juta di tanggal 30 akan terbaca sebagai "return bulan ini luar biasa". */
export function modifiedDietz(opsi: {
  bmv: number;
  emv: number;
  arus: readonly { tanggal: string; jumlah: number }[];
  mulai: string;
  akhir: string;
  bmvPerkiraan?: boolean;
}): HasilDietz {
  const { bmv, emv, mulai, akhir, bmvPerkiraan = false } = opsi;
  const T = hariAntara(mulai, akhir);

  const dalamPeriode = opsi.arus.filter((a) => a.tanggal > mulai && a.tanggal <= akhir);
  const cf = dalamPeriode.reduce((s, a) => s + a.jumlah, 0);

  const dasar: Omit<HasilDietz, "persen" | "modalRata"> = {
    bmv,
    emv,
    arusBersih: cf,
    bmvPerkiraan,
    mulai,
    akhir,
    hari: T,
  };

  if (T <= 0) {
    return { ...dasar, persen: null, modalRata: bmv, alasanKosong: "Periode belum berjalan sehari penuh." };
  }

  let tertimbang = bmv;
  for (const a of dalamPeriode) {
    const t = hariAntara(mulai, a.tanggal);
    tertimbang += a.jumlah * (1 - t / T);
  }

  if (tertimbang <= 0) {
    return {
      ...dasar,
      persen: null,
      modalRata: tertimbang,
      alasanKosong: "Belum ada modal yang bekerja di periode ini.",
    };
  }

  return { ...dasar, persen: ((emv - bmv - cf) / tertimbang) * 100, modalRata: tertimbang };
}

/** Return bulan berjalan, dirangkai dari snapshot + arus modal + nilai kini. */
export function returnBulanBerjalan(opsi: {
  totalNilai: number;
  transaksi: readonly Transaksi[];
  arus: readonly ArusModal[];
  snapshot: readonly Snapshot[];
  dasar: MataUang;
  kurs: Kurs;
  tanggal?: string;
}): HasilDietz {
  const { totalNilai, transaksi, arus, snapshot, dasar, kurs } = opsi;
  const kini = opsi.tanggal ?? hariIni();
  const mulai = awalBulan(kini);

  // Snapshot paling akhir yang jatuh pada atau sebelum awal bulan. Snapshot
  // tepat 3 hari sebelum awal bulan jauh lebih baik daripada nilai buku, tapi
  // yang lebih tua dari sebulan sudah tidak mewakili apa pun.
  const kandidat = snapshot
    .filter((s) => s.tanggal <= mulai && hariAntara(s.tanggal, mulai) <= 31)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];

  const bmv = kandidat
    ? konversi(kandidat.nilaiTotal, kandidat.mataUang, dasar, kurs)
    : nilaiBukuPada(transaksi, arus, mulai, dasar, kurs);

  const arusPeriode = arus.map((a) => ({
    tanggal: a.tanggal,
    jumlah:
      (a.tipe === "tarik" ? -1 : 1) *
      konversi(Math.abs(a.jumlah), a.mataUang, dasar, kurs),
  }));

  return modifiedDietz({
    bmv,
    emv: totalNilai,
    arus: arusPeriode,
    mulai,
    akhir: kini,
    bmvPerkiraan: !kandidat,
  });
}

export interface StatistikJurnal {
  totalTertutup: number;
  menang: number;
  kalah: number;
  impas: number;
  /** Persen. null kalau belum ada trade yang ditutup. */
  winRate: number | null;
  /** Rata-rata hasil dalam kelipatan risiko awal (R). */
  ekspektansiR: number | null;
  rataMenangR: number | null;
  rataKalahR: number | null;
  rrRencanaRata: number | null;
  terbuka: number;
}

/** R-multiple satu entri: hasil dibagi risiko yang direncanakan di awal.
 *  Diukur per unit, jadi tidak terpengaruh ukuran posisi. */
export function rMultiple(e: JurnalEntri): number | null {
  if (e.hargaKeluar === undefined || !Number.isFinite(e.hargaKeluar)) return null;
  const risiko = Math.abs(e.hargaEntry - e.stopLoss);
  if (!(risiko > 0)) return null;
  const arah = e.targetHarga >= e.hargaEntry ? 1 : -1;
  return ((e.hargaKeluar - e.hargaEntry) * arah) / risiko;
}

/** Rasio imbal-risiko yang direncanakan, dari entry/stop/target. */
export function rrRencana(e: {
  hargaEntry: number;
  stopLoss: number;
  targetHarga: number;
}): number | null {
  const risiko = Math.abs(e.hargaEntry - e.stopLoss);
  const imbalan = Math.abs(e.targetHarga - e.hargaEntry);
  if (!(risiko > 0)) return null;
  return imbalan / risiko;
}

/** Win rate dihitung dari trade yang sudah ditutup, bukan dari nilai
 *  portofolio, jadi setoran modal baru sama sekali tidak menyentuh angka ini. */
export function statistikJurnal(daftar: readonly JurnalEntri[]): StatistikJurnal {
  const tertutup = daftar.filter((e) => e.status === "tertutup" && e.hasil);
  const menang = tertutup.filter((e) => e.hasil === "untung").length;
  const kalah = tertutup.filter((e) => e.hasil === "rugi").length;
  const impas = tertutup.filter((e) => e.hasil === "impas").length;

  const semuaR = tertutup.map(rMultiple).filter((r): r is number => r !== null);
  const rMenang = semuaR.filter((r) => r > 0);
  const rKalah = semuaR.filter((r) => r < 0);
  const rencana = daftar.map(rrRencana).filter((r): r is number => r !== null);

  const rata = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  return {
    totalTertutup: tertutup.length,
    menang,
    kalah,
    impas,
    winRate: tertutup.length ? (menang / tertutup.length) * 100 : null,
    ekspektansiR: rata(semuaR),
    rataMenangR: rata(rMenang),
    rataKalahR: rata(rKalah),
    rrRencanaRata: rata(rencana),
    terbuka: daftar.filter((e) => e.status === "terbuka").length,
  };
}

/** Membandingkan hasil trade yang lahir dari saran AI dengan keputusan sendiri.
 *  Ini alasan koleksi `suggestions` ada: supaya saran AI bisa dinilai, bukan
 *  dituruti buta-buta. */
export function bandingkanSumber(daftar: readonly JurnalEntri[]): {
  dariSaran: StatistikJurnal;
  sendiri: StatistikJurnal;
} {
  return {
    dariSaran: statistikJurnal(daftar.filter((e) => e.idSaran)),
    sendiri: statistikJurnal(daftar.filter((e) => !e.idSaran)),
  };
}
