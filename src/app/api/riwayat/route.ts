import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Batang harian bertahun-tahun untuk satu ticker, dipakai chart Astro dan Sinyal.
 *
 * Sumbernya bukan Finnhub dan bukan CoinGecko seperti route lain. Candle
 * historis Finnhub hanya untuk paket berbayar, dan CoinGecko gratis memotong
 * riwayat di 365 hari; uji aspek yang lambat seperti Jupiter-Saturnus butuh
 * satu dekade. Yahoo (tanpa kunci) untuk saham, Binance untuk kripto.
 *
 * Binance dipanggil lewat data-api.binance.vision, cermin data publiknya.
 * api.binance.com membalas 451 untuk IP Amerika, dan fungsi Vercel berjalan
 * di Amerika.
 */

export interface BatangRiwayat {
  tanggal: string;
  buka: number;
  tinggi: number;
  rendah: number;
  tutup: number;
  /** Tidak ada untuk sesi yang volumenya tidak dilaporkan. Tidak diisi nol:
   *  nol akan terbaca sebagai sesi sepi, bukan sebagai data yang hilang. */
  volume?: number;
}

export interface HasilRiwayat {
  ticker: string;
  mataUang: "USD";
  sumber: string;
  batang: BatangRiwayat[];
}

type Gagal = { alasan: string; status: number };

const TAHUN = 10;

function dariStatus(status: number, ticker: string): Gagal {
  if (status === 429) return { alasan: "Sumber data sedang membatasi permintaan. Coba lagi semenit lagi.", status: 429 };
  return { alasan: `Riwayat ${ticker} tidak tersedia.`, status: 404 };
}

async function riwayatSaham(ticker: string): Promise<HasilRiwayat | Gagal> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${TAHUN}y&interval=1d`,
      // Tanpa User-Agent peramban, Yahoo membalas 429 ke hampir semua
      // permintaan dari server.
      { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return dariStatus(r.status, ticker);
    const j = (await r.json()) as {
      chart?: {
        result?: {
          meta?: { currency?: string; gmtoffset?: number };
          timestamp?: number[];
          indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
        }[];
      };
    };
    const hasil = j.chart?.result?.[0];
    const q = hasil?.indicators?.quote?.[0];
    if (!hasil?.timestamp?.length || !q) return dariStatus(404, ticker);
    // Route ini berjanji USD. Ticker bursa lain (misalnya BBCA.JK) datang
    // dalam mata uang lokal, dan melabelinya dolar adalah bug yang paling
    // mahal di proyek ini, jadi ditolak, bukan diteruskan.
    if (hasil.meta?.currency && hasil.meta.currency !== "USD") {
      return { alasan: `${ticker} berdenominasi ${hasil.meta.currency}, bukan USD.`, status: 422 };
    }
    // Stempel waktu Yahoo adalah jam buka sesi dalam UTC. Digeser ke zona
    // bursanya dulu, supaya tanggalnya tanggal sesi di New York.
    const geser = (hasil.meta?.gmtoffset ?? 0) * 1000;
    const batang: BatangRiwayat[] = [];
    hasil.timestamp.forEach((ts, i) => {
      const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
      // Yahoo menyelipkan null untuk sesi yang datanya bolong.
      if (!o || !h || !l || !c) return;
      const v = q.volume?.[i];
      batang.push({
        tanggal: new Date(ts * 1000 + geser).toISOString().slice(0, 10),
        buka: o, tinggi: h, rendah: l, tutup: c,
        ...(v ? { volume: v } : {}),
      });
    });
    if (!batang.length) return dariStatus(404, ticker);
    return { ticker, mataUang: "USD", sumber: "yahoo", batang };
  } catch {
    return { alasan: "Tidak bisa menghubungi sumber data saham.", status: 502 };
  }
}

async function riwayatKripto(ticker: string): Promise<HasilRiwayat | Gagal> {
  if (ticker === "USDT") return { alasan: "USDT tidak punya pasangan terhadap dirinya sendiri.", status: 404 };
  const simbol = `${ticker}USDT`;
  const batang: BatangRiwayat[] = [];
  let mulai = Date.now() - TAHUN * 365.25 * 86_400_000;
  try {
    // 1000 batang per panggilan, jadi sepuluh tahun butuh empat halaman.
    for (let halaman = 0; halaman < 5; halaman += 1) {
      const r = await fetch(
        `https://data-api.binance.vision/api/v3/klines?symbol=${simbol}&interval=1d&limit=1000&startTime=${Math.floor(mulai)}`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        // Binance membalas 400 untuk simbol yang tidak ada.
        return dariStatus(r.status === 400 ? 404 : r.status, ticker);
      }
      const j = (await r.json()) as [number, string, string, string, string, string][];
      for (const k of j) {
        batang.push({
          tanggal: new Date(k[0]).toISOString().slice(0, 10),
          buka: Number(k[1]), tinggi: Number(k[2]), rendah: Number(k[3]), tutup: Number(k[4]),
          ...(Number(k[5]) > 0 ? { volume: Number(k[5]) } : {}),
        });
      }
      if (j.length < 1000) break;
      mulai = j[j.length - 1][0] + 1;
    }
  } catch {
    return { alasan: "Tidak bisa menghubungi sumber data kripto.", status: 502 };
  }
  if (!batang.length) return dariStatus(404, ticker);
  // Harga USDT dianggap setara dolar. Selisihnya dari 1 biasanya di bawah
  // 0,1%, jauh di bawah derau return harian kripto.
  return { ticker, mataUang: "USD", sumber: "binance", batang };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const jenis = url.searchParams.get("jenis") === "kripto" ? "kripto" : "saham";
  if (!ticker || !/^[A-Z0-9.-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ galat: "Ticker tidak sah." }, { status: 400 });
  }

  const h = jenis === "kripto" ? await riwayatKripto(ticker) : await riwayatSaham(ticker);
  if ("alasan" in h) return NextResponse.json({ galat: h.alasan }, { status: h.status });
  // Batang harian cuma bertambah satu per hari, jadi CDN boleh menyimpannya
  // beberapa jam. Itu juga yang menjaga Yahoo dari permintaan berulang.
  return NextResponse.json(h, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
