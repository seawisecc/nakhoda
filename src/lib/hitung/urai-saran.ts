import type { JenisAset, MataUang, Rekomendasi } from "@/types";

/* Penguraian saran mentah dari AI lain.
 *
 * Masalahnya: tiap AI membalas dengan bentuk berbeda. Ada yang tabel markdown,
 * ada yang JSON, ada yang paragraf. Yang dikerjakan di sini adalah menarik
 * angka yang bisa ditarik, lalu MENGAKUI apa yang tidak ketemu.
 *
 * Prinsip yang dipegang: tidak pernah menebak angka. Field yang tidak
 * ditemukan dikembalikan sebagai null dan dicatat di `hilang`, supaya UI bisa
 * memintanya ke pengguna. Menebak harga stop dari konteks adalah cara paling
 * cepat membuat angka yang salah terlihat resmi.
 */

export interface BarisUrai {
  id: string;
  ticker: string;
  jenisAset: JenisAset;
  rekomendasi: Rekomendasi | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  mataUang: MataUang;
  catatan: string;
  /** Nama field yang tidak ditemukan, untuk disorot di UI. */
  hilang: string[];
}

export interface HasilUrai {
  baris: BarisUrai[];
  /** Potongan teks yang tidak menghasilkan baris apa pun. */
  takTerbaca: string[];
}

/* Kata yang berbentuk seperti ticker tapi bukan ticker. Tanpa daftar ini,
 * "RSI", "MACD", "BUY", dan "USD" semuanya akan jadi baris saran sendiri. */
const BUKAN_TICKER = new Set([
  "BUY", "SELL", "HOLD", "BELI", "JUAL", "TAHAN", "PANTAU", "WATCH", "LONG", "SHORT",
  "ENTRY", "STOP", "TARGET", "SL", "TP", "RR", "R", "USD", "IDR", "RP", "EUR",
  "RSI", "MACD", "MA", "EMA", "SMA", "ATH", "ATL", "VWAP", "PE", "PER", "EPS",
  "AI", "API", "ETF", "IPO", "CEO", "CFO", "YOY", "QOQ", "YTD", "FCF", "ROE",
  "DCA", "FOMO", "TA", "FA", "OK", "NO", "YES", "YA", "DAN", "ATAU", "UNTUK",
  "DARI", "KE", "DI", "PADA", "JIKA", "KALAU", "SAAT", "NOTE", "CATATAN",
  "REKOMENDASI", "ANALISIS", "TEKNIKAL", "FUNDAMENTAL", "RISIKO", "TICKER",
  "ASET", "HARGA", "NAMA", "NO", "TIDAK", "KRIPTO", "SAHAM", "CRYPTO", "STOCK",
]);

const PETA_REKOMENDASI: [RegExp, Rekomendasi][] = [
  [/\b(jual|sell|exit|keluar|tutup|close|lepas|reduce|kurangi|trim|take\s*profit)\b/i, "jual"],
  [/\b(beli|buy|long|akumulasi|accumulate|tambah|add|entry|masuk)\b/i, "beli"],
  [/\b(tahan|hold|hodl|pertahankan|maintain|biarkan)\b/i, "tahan"],
  [/\b(pantau|watch|monitor|tunggu|wait|netral|neutral|amati)\b/i, "pantau"],
];

/** Membaca angka dari teks apa pun yang ditulis AI.
 *
 *  Harus menangani "228.45", "228,45", "1.978,36", "$228.45", "Rp 1.510.162.854",
 *  dan "USD 79,700". Aturan pemisah ribuan sama dengan di formulir: pemisah
 *  ribuan selalu meninggalkan tepat tiga digit di belakangnya. */
export function bacaAngkaBebas(teks: string): number | null {
  const cocok = teks.match(/-?[\d][\d.,\s]*\d|-?\d/);
  if (!cocok) return null;
  const mentah = cocok[0].replace(/\s/g, "");
  const adaKoma = mentah.includes(",");
  const adaTitik = mentah.includes(".");

  let normal = mentah;
  if (adaKoma && adaTitik) {
    normal =
      mentah.lastIndexOf(",") > mentah.lastIndexOf(".")
        ? mentah.replace(/\./g, "").replace(",", ".")
        : mentah.replace(/,/g, "");
  } else if (adaKoma) {
    const bagian = mentah.split(",");
    normal =
      bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3)
        ? mentah.replace(/,/g, "")
        : mentah.replace(",", ".");
  } else if (adaTitik) {
    const bagian = mentah.split(".");
    normal =
      bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3)
        ? mentah.replace(/\./g, "")
        : mentah;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function cariBerlabel(teks: string, label: RegExp): number | null {
  const baris = teks.split(/\n|(?=\s\|\s)|;/);
  for (const b of baris) {
    if (!label.test(b)) continue;
    // Angka diambil dari SESUDAH labelnya, supaya "target 265" tidak salah
    // membaca angka yang kebetulan berdiri sebelum kata itu.
    const setelah = b.slice(b.search(label)).replace(label, " ");
    const n = bacaAngkaBebas(setelah);
    if (n !== null) return n;
  }
  return null;
}

function tebakMataUang(teks: string): MataUang {
  if (/\b(rp|idr)\b/i.test(teks)) return "IDR";
  return "USD";
}

function tebakJenis(ticker: string, teks: string): JenisAset {
  if (/\b(kripto|crypto|coin|token|blockchain)\b/i.test(teks)) return "kripto";
  return /^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|AVAX|DOT|LINK|MATIC|POL|TON|TRX|LTC|BCH|NEAR|APT|SUI|ARB|OP|INJ|SEI|TIA|PEPE|WIF|BONK|KAS|RUNE|LDO|STX)$/.test(ticker)
    ? "kripto"
    : "saham";
}

function rekomendasiDari(teks: string): Rekomendasi | null {
  for (const [pola, hasil] of PETA_REKOMENDASI) if (pola.test(teks)) return hasil;
  return null;
}

let hitungId = 0;
const idBaru = () => `urai-${Date.now().toString(36)}-${++hitungId}`;

function rakit(
  ticker: string,
  potongan: string,
  angka: { entry: number | null; stop: number | null; target: number | null },
): BarisUrai {
  const hilang: string[] = [];
  const rekomendasi = rekomendasiDari(potongan);
  if (!rekomendasi) hilang.push("rekomendasi");
  if (angka.entry === null) hilang.push("entry");
  if (angka.stop === null) hilang.push("stop");
  if (angka.target === null) hilang.push("target");

  return {
    id: idBaru(),
    ticker,
    jenisAset: tebakJenis(ticker, potongan),
    rekomendasi,
    entry: angka.entry,
    stop: angka.stop,
    target: angka.target,
    mataUang: tebakMataUang(potongan),
    catatan: potongan.trim().slice(0, 1200),
    hilang,
  };
}

/* ── Jalur 1: JSON ──────────────────────────────────────────────────────── */

function dariJson(teks: string): BarisUrai[] | null {
  const mulai = teks.indexOf("[");
  const akhir = teks.lastIndexOf("]");
  if (mulai === -1 || akhir <= mulai) return null;
  let isi: unknown;
  try {
    isi = JSON.parse(teks.slice(mulai, akhir + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(isi) || !isi.length) return null;

  const baris: BarisUrai[] = [];
  for (const item of isi) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const ticker = String(o.ticker ?? o.symbol ?? o.kode ?? "").trim().toUpperCase();
    if (!ticker || BUKAN_TICKER.has(ticker)) continue;

    const ambil = (...kunci: string[]): number | null => {
      for (const k of kunci) {
        const v = o[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
          const n = bacaAngkaBebas(v);
          if (n !== null) return n;
        }
      }
      return null;
    };

    const teksItem = JSON.stringify(o);
    baris.push(
      rakit(ticker, teksItem, {
        entry: ambil("entry", "suggestedEntry", "entryPrice", "hargaEntry", "buy", "masuk"),
        stop: ambil("stop", "stopLoss", "suggestedStop", "sl", "stop_loss"),
        target: ambil("target", "targetPrice", "suggestedTarget", "tp", "take_profit"),
      }),
    );
  }
  return baris.length ? baris : null;
}

/* ── Jalur 2: tabel markdown ────────────────────────────────────────────── */

function dariTabel(teks: string): BarisUrai[] | null {
  const baris = teks.split("\n").filter((b) => b.trim().startsWith("|") && b.includes("|", 1));
  if (baris.length < 2) return null;

  const sel = (b: string) =>
    b.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim());

  const kepala = sel(baris[0]).map((h) => h.toLowerCase());
  const cari = (...kata: string[]) =>
    kepala.findIndex((h) => kata.some((k) => h.includes(k)));

  const kTicker = cari("ticker", "simbol", "symbol", "kode", "aset", "saham");
  if (kTicker === -1) return null;
  const kEntry = cari("entry", "masuk", "beli di", "buy");
  const kStop = cari("stop", "sl", "cut");
  const kTarget = cari("target", "tp", "take profit");
  const kRek = cari("rekomendasi", "aksi", "action", "sinyal", "signal", "saran");

  const hasil: BarisUrai[] = [];
  for (const b of baris.slice(1)) {
    const kolom = sel(b);
    // Baris pemisah tabel markdown: |---|---|
    if (kolom.every((c) => /^:?-+:?$/.test(c) || c === "")) continue;

    const ticker = (kolom[kTicker] ?? "").replace(/[^A-Za-z0-9.]/g, "").toUpperCase();
    if (!ticker || BUKAN_TICKER.has(ticker)) continue;

    const konteks = [kolom[kRek] ?? "", ...kolom].join(" | ");
    hasil.push(
      rakit(ticker, konteks, {
        entry: kEntry >= 0 ? bacaAngkaBebas(kolom[kEntry] ?? "") : null,
        stop: kStop >= 0 ? bacaAngkaBebas(kolom[kStop] ?? "") : null,
        target: kTarget >= 0 ? bacaAngkaBebas(kolom[kTarget] ?? "") : null,
      }),
    );
  }
  return hasil.length ? hasil : null;
}

/* ── Jalur 3: teks bebas ────────────────────────────────────────────────── */

const POLA_TICKER = /\b([A-Z]{1,6})\b/g;

function dariTeks(teks: string): { baris: BarisUrai[]; takTerbaca: string[] } {
  // Dipecah per paragraf. Kebanyakan AI menulis satu ticker per blok, dan
  // memecah per baris akan mencerai-beraikan angka dari tickernya.
  const blok = teks
    .split(/\n\s*\n|(?=^#{1,6}\s)|(?=^\s*[-*]\s+\*{0,2}[A-Z]{2,6}\b)/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const baris: BarisUrai[] = [];
  const takTerbaca: string[] = [];

  for (const b of blok) {
    const kandidat = [...b.matchAll(POLA_TICKER)]
      .map((m) => m[1])
      .filter((t) => !BUKAN_TICKER.has(t) && t.length >= 2);
    if (!kandidat.length) {
      if (b.length > 25) takTerbaca.push(b.slice(0, 200));
      continue;
    }

    // Ticker yang paling sering disebut di blok itu, bukan yang pertama
    // muncul; kalimat pembuka sering menyebut ticker lain sebagai pembanding.
    const jumlah = new Map<string, number>();
    for (const t of kandidat) jumlah.set(t, (jumlah.get(t) ?? 0) + 1);
    const ticker = [...jumlah.entries()].sort((a, b2) => b2[1] - a[1])[0][0];

    baris.push(
      rakit(ticker, b, {
        entry: cariBerlabel(b, /\b(entry|masuk|buy\s*at|beli\s*di|harga\s*beli)\b\s*:?/i),
        stop: cariBerlabel(b, /\b(stop\s*loss|stop|sl|cut\s*loss)\b\s*:?/i),
        target: cariBerlabel(b, /\b(target|tp|take\s*profit|sasaran)\b\s*:?/i),
      }),
    );
  }
  return { baris, takTerbaca };
}

/* ── Pintu masuk ────────────────────────────────────────────────────────── */

/** Menggabungkan baris berticker sama, karena AI sering menyebut satu ticker
 *  di dua tempat: sekali di tabel ringkas, sekali di penjelasan panjang. */
function gabungkan(baris: BarisUrai[]): BarisUrai[] {
  const peta = new Map<string, BarisUrai>();
  for (const b of baris) {
    const ada = peta.get(b.ticker);
    if (!ada) {
      peta.set(b.ticker, b);
      continue;
    }
    const gabung: BarisUrai = {
      ...ada,
      rekomendasi: ada.rekomendasi ?? b.rekomendasi,
      entry: ada.entry ?? b.entry,
      stop: ada.stop ?? b.stop,
      target: ada.target ?? b.target,
      catatan: [ada.catatan, b.catatan].filter(Boolean).join("\n\n").slice(0, 1200),
      hilang: [],
    };
    if (!gabung.rekomendasi) gabung.hilang.push("rekomendasi");
    if (gabung.entry === null) gabung.hilang.push("entry");
    if (gabung.stop === null) gabung.hilang.push("stop");
    if (gabung.target === null) gabung.hilang.push("target");
    peta.set(b.ticker, gabung);
  }
  return [...peta.values()];
}

export function uraiSaran(teks: string): HasilUrai {
  const bersih = teks.replace(/\r\n/g, "\n").trim();
  if (!bersih) return { baris: [], takTerbaca: [] };

  const json = dariJson(bersih);
  if (json) return { baris: gabungkan(json), takTerbaca: [] };

  const tabel = dariTabel(bersih);
  const bebas = dariTeks(bersih);

  if (tabel) {
    // Tabel memberi angka, teks di sekitarnya memberi alasan. Keduanya
    // digabung supaya catatan tidak hilang hanya karena tabelnya rapi.
    return { baris: gabungkan([...tabel, ...bebas.baris]), takTerbaca: [] };
  }
  return { baris: gabungkan(bebas.baris), takTerbaca: bebas.takTerbaca };
}
