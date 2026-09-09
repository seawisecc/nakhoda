import type { JurnalEntri, MataUang, Posisi } from "@/types";
import { konversi, type Kurs } from "./uang";
import type { RingkasanPortofolio, HasilDietz } from "./kinerja";

/* Tinjauan portofolio.
 *
 * Menjawab satu pertanyaan: hari ini sebenarnya ada apa yang perlu diputuskan.
 *
 * Semua yang dihasilkan di sini adalah ARITMATIKA atas data yang sudah ada di
 * Nakhoda, bukan pendapat dan bukan ramalan. Tiap temuan bisa ditelusuri
 * angkanya sampai ke transaksi dan jurnal yang kamu tulis sendiri. Itu
 * disengaja: bagian yang bisa dihitung harus dihitung, supaya penilaian
 * manusia bisa dipakai untuk hal yang memang butuh penilaian.
 *
 * Yang TIDAK dilakukan di sini: menyuruh beli atau jual apa pun.
 */

export type NadaTemuan = "bahaya" | "perhatian" | "peluang" | "netral";

export interface Temuan {
  id: string;
  nada: NadaTemuan;
  judul: string;
  /** Kalimat yang menjelaskan angkanya, bukan menyuruh. */
  penjelasan: string;
  ticker?: string;
  /** Angka utama temuan ini, sudah diformat oleh pemanggil kalau perlu. */
  nilai?: number;
  mataUang?: MataUang;
  /** Makin kecil makin dulu ditampilkan. */
  urutan: number;
}

export interface InputTinjauan {
  posisi: readonly Posisi[];
  jurnal: readonly JurnalEntri[];
  ringkasan: RingkasanPortofolio;
  dietz: HasilDietz;
  targetMin: number;
  targetMaks: number;
  /** Persen modal yang direlakan hilang per satu trade. */
  risikoPerTrade: number;
  kurs: Kurs;
}

/** Ambang konsentrasi. Bukan aturan baku, tapi di atas ini satu posisi yang
 *  salah sudah cukup untuk menentukan hasil seluruh bulan. */
const AMBANG_KONSENTRASI = 0.25;
/** Kas menganggur di atas porsi ini layak disebut, karena modal yang tidak
 *  bekerja tetap punya ongkos: dia tidak ikut mengejar target. */
const AMBANG_KAS = 0.35;

export function susunTinjauan(x: InputTinjauan): Temuan[] {
  const { posisi, jurnal, ringkasan, dietz, targetMin, risikoPerTrade, kurs } = x;
  const dasar = ringkasan.mataUang;
  const temuan: Temuan[] = [];

  const aktif = posisi.filter((p) => p.qty > 0);
  const keDasar = (n: number, m: MataUang) => konversi(n, m, dasar, kurs);

  /* ── Stop dan target yang sudah terlampaui ──────────────────────────
     Ini yang paling mendesak: rencana yang kamu tulis sendiri sudah kena,
     tapi posisinya masih terbuka. */
  for (const e of jurnal) {
    if (e.status !== "terbuka") continue;
    const p = aktif.find((q) => q.ticker === e.ticker);
    if (!p || p.hargaTerakhir === undefined) continue;

    const harga = konversi(p.hargaTerakhir, p.mataUang, e.mataUang, kurs);
    const long = e.targetHarga >= e.hargaEntry;
    const stopKena = long ? harga <= e.stopLoss : harga >= e.stopLoss;
    const targetKena = long ? harga >= e.targetHarga : harga <= e.targetHarga;

    if (stopKena) {
      temuan.push({
        id: `stop-${e.id}`, nada: "bahaya", ticker: e.ticker, urutan: 0,
        judul: `${e.ticker} sudah melewati stop loss`,
        penjelasan: "Posisinya masih terbuka dan jurnalnya belum ditutup.",
      });
    } else if (targetKena) {
      temuan.push({
        id: `target-${e.id}`, nada: "peluang", ticker: e.ticker, urutan: 1,
        judul: `${e.ticker} sudah mencapai target`,
        penjelasan: "Posisinya masih terbuka.",
      });
    }
  }

  /* ── Posisi tanpa rencana keluar tertulis ──────────────────────────── */
  const punyaJurnalTerbuka = new Set(
    jurnal.filter((e) => e.status === "terbuka").map((e) => e.ticker),
  );
  const tanpaRencana = aktif.filter((p) => !punyaJurnalTerbuka.has(p.ticker));
  if (tanpaRencana.length) {
    temuan.push({
      id: "tanpa-rencana", nada: "perhatian", urutan: 3,
      judul: `${tanpaRencana.length} posisi belum punya rencana keluar tertulis`,
      penjelasan: `${tanpaRencana.map((p) => p.ticker).join(", ")} belum punya stop dan target tercatat.`,
    });
  }

  /* ── Konsentrasi ────────────────────────────────────────────────────── */
  if (ringkasan.totalNilai > 0) {
    for (const p of aktif) {
      const nilai = keDasar(p.nilaiPasar ?? p.biayaTotal, p.mataUang);
      const porsi = nilai / ringkasan.totalNilai;
      if (porsi >= AMBANG_KONSENTRASI) {
        temuan.push({
          id: `konsentrasi-${p.ticker}`, nada: "perhatian", ticker: p.ticker,
          nilai: porsi * 100, urutan: 4,
          judul: `${p.ticker} memegang ${(porsi * 100).toFixed(1).replace(".", ",")}% portofolio`,
          penjelasan: "Satu posisi ini sendirian menentukan hasil bulanmu.",
        });
      }
    }
  }

  /* ── Kas menganggur ─────────────────────────────────────────────────── */
  if (ringkasan.totalNilai > 0 && ringkasan.kas > 0) {
    const porsi = ringkasan.kas / ringkasan.totalNilai;
    if (porsi >= AMBANG_KAS) {
      temuan.push({
        id: "kas-nganggur", nada: "netral", nilai: ringkasan.kas, mataUang: dasar, urutan: 5,
        judul: `${(porsi * 100).toFixed(0)}% portofolio masih berupa kas`,
        penjelasan: "Modal yang tidak bekerja tidak ikut mengejar target.",
      });
    }
  }

  /* ── Jarak ke target bulanan ────────────────────────────────────────── */
  if (dietz.persen !== null && dietz.bmv > 0) {
    const capaian = dietz.persen;
    const kurang = targetMin - capaian;
    const rupiahKurang = (kurang / 100) * dietz.bmv;
    if (kurang > 0) {
      temuan.push({
        id: "jarak-target", nada: "netral", nilai: rupiahKurang, mataUang: dasar, urutan: 2,
        judul: `Kurang ${kurang.toFixed(2).replace(".", ",")}% lagi untuk menyentuh batas bawah target`,
        penjelasan: dietz.bmvPerkiraan
          ? "Atas nilai awal bulan, yang sendirinya masih perkiraan."
          : "Atas nilai awal bulan.",
      });
    } else {
      temuan.push({
        id: "target-tercapai", nada: "peluang", urutan: 2,
        judul: `Target bulan ini sudah terlampaui`,
        penjelasan: "Sisa bulan tidak menuntut apa-apa.",
      });
    }
  }

  /* ── Jatah risiko per trade ─────────────────────────────────────────── */
  if (ringkasan.totalNilai > 0 && risikoPerTrade > 0) {
    temuan.push({
      id: "jatah-risiko", nada: "netral", urutan: 6,
      nilai: ringkasan.totalNilai * (risikoPerTrade / 100), mataUang: dasar,
      judul: `Jatah risiko per trade pada ${risikoPerTrade.toFixed(1).replace(".", ",")}%`,
      penjelasan: "Batas kerugian satu trade kalau stop kena.",
    });
  }

  return temuan.sort((a, b) => a.urutan - b.urutan || a.id.localeCompare(b.id));
}
