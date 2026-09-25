import { formatAngka, formatPersen, formatUang } from "@/lib/format";
import { RR_MIN, layakSaran, type HasilSinyal, type RingkasanPindai } from "./evaluasi-sinyal";
import type { BatangHarian, HasilUji, Penilaian } from "./uji-kejadian";

/* Narasi hasil pembacaan chart, dalam bahasa sehari-hari.
 *
 * Layar Sinyal, Serupa, dan Astro ditulis dengan istilah uji ("seperti
 * acak", "terbalik", "peluang kebetulan"). Istilah itu tepat tapi tidak
 * menjawab pertanyaan yang sebenarnya ditanyakan di depan chart: apa yang
 * terlihat, apakah itu bisa dipercaya, dan apa yang harus dilakukan. Modul
 * ini menjawab ketiganya, dari angka yang SAMA dengan tabel di bawahnya.
 * Narasi tidak boleh lebih optimis dari ujinya.
 *
 * Perkiraan harga di sini adalah rentang, bukan satu angka. Diambil dari apa
 * yang benar-benar terjadi sesudah kejadian yang sama di ticker yang sama
 * (kuartil 25, 50, 75), selalu berdampingan dengan rentang hari biasa.
 * Satu angka target ("naik ke $2.000") terlihat pasti padahal tidak, dan
 * angka tebakan yang dilabeli rapi lebih berbahaya daripada tidak ada angka.
 */

export interface Narasi {
  /** Apa yang terlihat di chart. */
  terlihat: string;
  /** Apakah catatannya cukup untuk dipercaya. */
  percaya: string;
  /** Apa yang sebaiknya dilakukan. */
  tindakan: string;
}

/** Kuartil hasil, sebagai pecahan (0,05 berarti 5%). */
export interface Sebaran {
  bawah: number;
  tengah: number;
  atas: number;
  n: number;
}

/** Di bawah lima kejadian, kuartil cuma urutan beberapa angka. Batasnya sama
 *  dengan batas "terlalu jarang" di uji-kejadian. */
const MIN_SEBARAN = 5;

function kuantil(urut: number[], p: number): number {
  const posisi = (urut.length - 1) * p;
  const kiri = Math.floor(posisi);
  const kanan = Math.ceil(posisi);
  return urut[kiri] + (urut[kanan] - urut[kiri]) * (posisi - kiri);
}

/** Kuartil 25, 50, dan 75. Separuh kejadian jatuh di antara bawah dan atas.
 *  Kuartil, bukan minimum dan maksimum: satu kejatuhan 2020 akan membuat
 *  rentang min-maks selebar apa pun dan tidak mengatakan apa-apa. */
export function sebaran(hasil: readonly number[]): Sebaran | null {
  if (hasil.length < MIN_SEBARAN) return null;
  const urut = [...hasil].sort((a, b) => a - b);
  return { bawah: kuantil(urut, 0.25), tengah: kuantil(urut, 0.5), atas: kuantil(urut, 0.75), n: urut.length };
}

/** Sebaran return h sesi dari setiap hari di data yang sama: pembanding
 *  "kalau tidak ada pola apa pun". */
export function sebaranHariBiasa(batang: readonly BatangHarian[], horizon: number): Sebaran | null {
  const h = Math.max(1, Math.floor(horizon));
  const semua: number[] = [];
  for (let i = 0; i + h < batang.length; i += 1) {
    if (batang[i].tutup > 0) semua.push(batang[i + h].tutup / batang[i].tutup - 1);
  }
  return sebaran(semua);
}

export interface RentangHarga {
  /** Harga acuan, biasanya tutup terakhir. */
  dari: number;
  /** Jumlah kejadian di balik rentang ini. */
  n: number;
  /** Harga, dalam mata uang yang sama dengan `dari`. */
  bawah: number;
  tengah: number;
  atas: number;
  biasa: { bawah: number; tengah: number; atas: number } | null;
}

export function rentangHarga(pola: Sebaran, biasa: Sebaran | null, harga: number): RentangHarga {
  const ke = (s: Sebaran) => ({
    bawah: harga * (1 + s.bawah), tengah: harga * (1 + s.tengah), atas: harga * (1 + s.atas),
  });
  return { dari: harga, n: pola.n, ...ke(pola), biasa: biasa ? ke(biasa) : null };
}

/** Satu kalimat rentang, dengan peringatan yang menempel pada tingkat ujinya.
 *  Rentang dari pola yang tidak lolos tetap ditampilkan, karena dia menjawab
 *  pertanyaan yang sah (seberapa jauh harga ini biasa bergerak), tapi
 *  kalimatnya bilang terus terang bahwa itu bukan ramalan. */
export function kalimatRentang(
  r: RentangHarga, tingkat: Penilaian["tingkat"], horizon: number, satuan: string, ticker: string,
): string {
  const uang = (x: number) => formatUang(x, "USD");
  const inti = `Dari ${r.n} kejadian sebelumnya, ${horizon} ${satuan} kemudian ${ticker} biasanya ada di antara ${uang(r.bawah)} dan ${uang(r.atas)}, titik tengah ${uang(r.tengah)}, dihitung dari harga sekarang ${uang(r.dari)}.`;
  const biasa = r.biasa ? ` Di hari biasa rentangnya ${uang(r.biasa.bawah)} sampai ${uang(r.biasa.atas)}.` : "";
  const peringatan = tingkat === "catatan"
    ? ""
    : " Rentang ini tidak beda nyata dari hari biasa, jadi bacalah sebagai gerak normal harganya, bukan ramalan.";
  return `${inti}${biasa}${peringatan}`;
}

/** Kalimat rentang dalam persen, untuk kejadian yang harganya belum
 *  diketahui (aspek yang akan datang). */
export function kalimatRentangPersen(
  pola: Sebaran, biasa: Sebaran | null, tingkat: Penilaian["tingkat"], horizon: number, satuan: string,
): string {
  const p = (x: number) => formatPersen(x * 100, 1);
  const inti = `Dalam ${horizon} ${satuan} sesudahnya, harga biasanya bergerak antara ${p(pola.bawah)} dan ${p(pola.atas)}, titik tengah ${p(pola.tengah)}.`;
  const b = biasa ? ` Hari biasa: ${p(biasa.bawah)} sampai ${p(biasa.atas)}.` : "";
  const peringatan = tingkat === "catatan" ? "" : " Tidak beda nyata dari hari biasa.";
  return `${inti}${b}${peringatan}`;
}

const persen = (x: number) => formatPersen(x * 100, 1);

/** Jawaban "bisa dipercaya?" untuk hasil uji apa pun. `nama` adalah subjek
 *  kalimatnya, misalnya "pola ini" atau "bentuk seperti ini". */
function jawabPercaya(
  nama: string, ticker: string, uji: HasilUji, nilai: Penilaian, horizon: number, satuan: string,
  arah?: "naik" | "turun",
): string {
  const n = uji.kejadian.length;
  if (nilai.tingkat === "jarang" || uji.rataRata === null || !uji.dasar) {
    return n
      ? `Belum bisa dinilai. Di ${ticker} ${nama} baru muncul ${n} kali, terlalu sedikit untuk dibedakan dari kebetulan.`
      : `Belum bisa dinilai. ${kapital(nama)} belum pernah muncul di data ${ticker}.`;
  }
  const naik = Math.round(((uji.persenNaik ?? 0) / 100) * n);
  const angka = `rata-rata ${persen(uji.rataRata)} dalam ${horizon} ${satuan}, sementara hari biasa ${persen(uji.dasar.rataRata)}`;
  if (nilai.tingkat === "acak") {
    return `Tidak. ${kapital(nama)} sudah muncul ${n} kali di ${ticker} dan hasilnya sama saja dengan hari biasa: ${angka}.`;
  }
  if (nilai.tingkat === "lemah") {
    return `Belum cukup. Ada sedikit beda dari hari biasa (${angka}), tapi beda sebesar itu masih wajar muncul karena kebetulan dari ${n} kejadian.`;
  }
  if (arah && nilai.searah === false) {
    const lawan = arah === "naik" ? "turun" : "naik";
    return `Justru sebaliknya. Di ${ticker}, ${nama} lebih sering diikuti harga ${lawan}: ${angka}, dari ${n} kejadian.`;
  }
  return `Ya, catatannya cukup. Sesudah ${nama}, ${ticker} naik ${naik} dari ${n} kali, ${angka}. Beda sebesar ini sulit dijelaskan sebagai kebetulan.`;
}

function kapital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kapan(umur: number): string {
  return umur === 0 ? "di sesi terakhir" : umur === 1 ? "kemarin" : `${umur} sesi lalu`;
}

export interface KonteksSinyal {
  ticker: string;
  dipegang: boolean;
  horizon: number;
  /** Indeks batang terakhir, untuk menghitung umur tanda. */
  indeksAkhir: number;
  /** "hari bursa" untuk saham, "hari" untuk kripto yang pasarnya tidak libur. */
  satuan: string;
}

export function narasiSinyal(h: HasilSinyal, k: KonteksSinyal): Narasi {
  const umur = h.aktifDi === null ? null : k.indeksAkhir - h.aktifDi;
  const terlihat = umur === null
    ? `${h.def.nama}: ${h.def.keterangan}`
    : `${h.def.nama} muncul ${kapan(umur)}. Artinya: ${h.def.keterangan.charAt(0).toLowerCase()}${h.def.keterangan.slice(1)}`;
  const percaya = jawabPercaya("pola ini", k.ticker, h.uji, h.nilai, k.horizon, k.satuan, h.def.arah);
  return { terlihat, percaya, tindakan: tindakanSinyal(h, k) };
}

function tindakanSinyal(h: HasilSinyal, k: KonteksSinyal): string {
  const tetap = k.dipegang
    ? ` Karena kamu memegang ${k.ticker}, yang berlaku tetap rencanamu sendiri; kalau belum punya batas rugi, tulis dulu di Jurnal.`
    : "";
  if (h.nilai.tingkat !== "catatan") return `Tidak perlu berbuat apa-apa karena tanda ini.${tetap}`;
  if (h.nilai.searah === false) return `Jangan ikuti arah pola ini.${tetap}`;
  if (h.def.arah === "turun" && !k.dipegang) {
    return `Kamu tidak memegang ${k.ticker}, jadi tidak ada yang dijual. Artinya cuma satu: jangan beli dulu.`;
  }
  if (!h.level) {
    return `Polanya bisa dipercaya, tapi tidak ada rencana masuk yang masuk akal sekarang: harga sudah melewati batas rugi polanya, atau gerak khasnya berlawanan. Lewati.${tetap}`;
  }
  const { entry, stop, target, rr } = h.level;
  const uang = (x: number) => formatUang(x, "USD");
  if (!layakSaran(h, k.dipegang)) {
    return `Polanya bisa dipercaya, tapi untungnya terlalu kecil dibanding risikonya (1 : ${formatAngka(rr, 2)}, minimal 1 : ${formatAngka(RR_MIN, 1)}). Lewati.${tetap}`;
  }
  const naik = h.def.arah === "naik";
  const aksi = naik ? `beli ${k.ticker}` : `jual atau kurangi ${k.ticker}`;
  const batal = naik ? "di bawah" : "di atas";
  return `Layak dipertimbangkan untuk ${aksi}. Masuk sekitar ${uang(entry)}, batal kalau harga tutup ${batal} ${uang(stop)}, target ${uang(target)}. Untuk setiap 1 yang dipertaruhkan, imbalan khasnya ${formatAngka(rr, 2)}. Tombol "Jadikan saran" mencatat rencana ini.`;
}

export interface KonteksSerupa {
  ticker: string;
  dipegang: boolean;
  horizon: number;
  satuan: string;
  panjang: number;
  paling: { tanggal: string; korelasi: number } | null;
  jumlah: number;
}

export function narasiSerupa(uji: HasilUji | null, nilai: Penilaian | null, k: KonteksSerupa): Narasi {
  if (!k.jumlah || !uji || !nilai) {
    return {
      terlihat: `Bentuk ${k.panjang} sesi terakhir ${k.ticker} tidak punya kembaran yang cukup mirip di riwayatnya sendiri.`,
      percaya: "Tidak ada yang bisa dinilai.",
      tindakan: "Tidak ada yang perlu dilakukan dari layar ini.",
    };
  }
  const terlihat = `Bentuk ${k.panjang} sesi terakhir ${k.ticker} mirip dengan ${k.jumlah} momen di masa lalunya${
    k.paling ? `; yang paling mirip berakhir ${k.paling.tanggal} (kemiripan ${formatAngka(k.paling.korelasi, 2)} dari 1)` : ""
  }.`;
  const percaya = jawabPercaya("bentuk seperti ini", k.ticker, uji, nilai, k.horizon, k.satuan);
  const tindakan = nilai.tingkat === "catatan"
    ? `Pakai sebagai bahan pertimbangan tambahan, bukan alasan tunggal. Layar ini tidak memberi batas rugi, jadi keputusan beli atau jual tetap butuh tanda di tab Sinyal atau rencanamu sendiri.`
    : `Tidak perlu berbuat apa-apa karena bentuk ini.${k.dipegang ? ` Untuk ${k.ticker} yang kamu pegang, rencanamu sendiri yang berlaku; kalau belum punya batas rugi, tulis dulu di Jurnal.` : ""}`;
  return { terlihat, percaya, tindakan };
}

export interface HasilAspek {
  nama: string;
  uji: HasilUji | null;
  nilai: Penilaian | null;
}

export interface KonteksAstro {
  ticker: string;
  pasangan: string;
  horizon: number;
  satuan: string;
  berikutnya: { nama: string; tanggal: string } | null;
}

export function narasiAstro(hasil: readonly HasilAspek[], k: KonteksAstro): Narasi {
  const terlihat = k.berikutnya
    ? `Aspek ${k.pasangan} berikutnya: ${k.berikutnya.nama.toLowerCase()} pada ${k.berikutnya.tanggal}.`
    : `Tidak ada aspek ${k.pasangan} dalam 12 bulan ke depan.`;
  const lolos = hasil.filter((x) => x.nilai?.tingkat === "catatan" && x.uji);
  const lemah = hasil.filter((x) => x.nilai?.tingkat === "lemah");
  let percaya: string;
  if (lolos.length) {
    percaya = lolos
      .map((x) => jawabPercaya(`${x.nama.toLowerCase()}`, k.ticker, x.uji!, x.nilai!, k.horizon, k.satuan))
      .join(" ");
  } else {
    percaya = `Tidak. Tidak satu pun dari ${hasil.length} aspek ${k.pasangan} yang hasilnya beda dari hari biasa di ${k.ticker}${
      lemah.length ? `; ${lemah.map((x) => x.nama.toLowerCase()).join(" dan ")} cuma beda tipis yang masih wajar karena kebetulan` : ""
    }.`;
  }
  const tindakan = lolos.length
    ? "Kalau mau dipakai, perlakukan sebagai kalender waspada, bukan sinyal beli atau jual: aspek tidak menunjuk arah dan tidak punya batas rugi."
    : `Abaikan pasangan ini untuk ${k.ticker}.`;
  return { terlihat, percaya, tindakan };
}

/** Satu kalimat tindakan untuk satu baris pemindai. */
export function tindakanPindai(r: RingkasanPindai, ticker: string): string {
  if (r.layak.length) {
    const terbaik = [...r.layak].sort((a, b) => b.level!.rr - a.level!.rr)[0];
    const naik = terbaik.def.arah === "naik";
    return `Pertimbangkan ${naik ? "beli" : "jual atau kurangi"}: ${terbaik.def.nama}, imbalan ${formatAngka(terbaik.level!.rr, 2)} kali risiko. Buka untuk levelnya.`;
  }
  if (!r.aktif.length) return "Diam saja. Tidak ada pola yang muncul.";
  const terbalik = r.aktif.some((h) => h.nilai.tingkat === "catatan" && h.nilai.searah === false);
  return terbalik
    ? `Diam saja. Ada pola yang di ${ticker} justru bergerak berlawanan dengan arahnya; jangan ikuti.`
    : `Diam saja. ${r.aktif.length === 1 ? "Pola yang muncul" : `${r.aktif.length} pola yang muncul`} tidak punya catatan yang bisa dipercaya di ${ticker}.`;
}
