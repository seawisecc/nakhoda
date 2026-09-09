import { NextResponse } from "next/server";
import { ID_KRIPTO } from "@/lib/kripto-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* OHLC sesi terakhir untuk satu ticker.
 *
 * Dipakai halaman Chart untuk menghitung pivot dan Fibonacci. Sengaja terpisah
 * dari /api/harga: yang itu dipanggil untuk belasan ticker sekaligus dan hanya
 * butuh harga terakhir, sedangkan yang ini satu ticker dengan data lebih lebar.
 * Menggabungkannya akan membuat penyegaran harga menarik data yang tidak
 * dipakai untuk setiap posisi.
 */

export interface HasilOhlc {
  ticker: string;
  buka: number;
  tinggi: number;
  rendah: number;
  tutup: number;
  tutupSebelumnya?: number;
  mataUang: "USD";
  sumber: string;
}

/* Kegagalan dibedakan, bukan disamaratakan jadi "tidak tersedia". Rate limit
   berarti "coba lagi sebentar", ticker salah berarti "perbaiki tickernya", dan
   keduanya menyuruh orang mencari masalah di tempat yang berbeda. */
type Gagal = { alasan: string; status: number };

function dariStatus(status: number, ticker: string): Gagal {
  if (status === 429) return { alasan: "Sumber data sedang membatasi permintaan. Coba lagi semenit lagi.", status: 429 };
  if (status === 401 || status === 403) return { alasan: "Kunci API ditolak sumber data.", status: 502 };
  return { alasan: `OHLC ${ticker} tidak tersedia.`, status: 404 };
}

async function ohlcSaham(ticker: string, kunci: string): Promise<HasilOhlc | Gagal> {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${kunci}`,
      { cache: "no-store" },
    );
    if (!r.ok) return dariStatus(r.status, ticker);
    const j = (await r.json()) as { c?: number; h?: number; l?: number; o?: number; pc?: number };
    // Finnhub membalas 200 dengan angka nol untuk simbol tak dikenal, jadi
    // status HTTP saja tidak cukup untuk menyatakan berhasil.
    if (!j.c || !j.h || !j.l || !j.o) return dariStatus(404, ticker);
    return {
      ticker, buka: j.o, tinggi: j.h, rendah: j.l, tutup: j.c,
      tutupSebelumnya: j.pc && j.pc > 0 ? j.pc : undefined,
      mataUang: "USD", sumber: "finnhub",
    };
  } catch {
    return { alasan: "Tidak bisa menghubungi sumber data saham.", status: 502 };
  }
}

async function ohlcKripto(ticker: string): Promise<HasilOhlc | Gagal> {
  const id = ID_KRIPTO[ticker];
  if (!id) return { alasan: `${ticker} belum ada di peta id CoinGecko.`, status: 404 };
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return dariStatus(r.status, ticker);
    const j = (await r.json()) as {
      current_price?: number; high_24h?: number; low_24h?: number; price_change_24h?: number;
    }[];
    const d = Array.isArray(j) ? j[0] : undefined;
    if (!d?.current_price || !d.high_24h || !d.low_24h) return dariStatus(404, ticker);
    // CoinGecko tidak memberi harga buka. Diturunkan dari harga sekarang
    // dikurangi perubahan 24 jam, yang memang definisi harga 24 jam lalu.
    const buka =
      typeof d.price_change_24h === "number"
        ? d.current_price - d.price_change_24h
        : d.current_price;
    return {
      ticker, buka, tinggi: d.high_24h, rendah: d.low_24h, tutup: d.current_price,
      tutupSebelumnya: buka, mataUang: "USD", sumber: "coingecko",
    };
  } catch {
    return { alasan: "Tidak bisa menghubungi sumber data kripto.", status: 502 };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const jenis = url.searchParams.get("jenis") === "kripto" ? "kripto" : "saham";
  if (!ticker || !/^[A-Z0-9.]{1,10}$/.test(ticker)) {
    return NextResponse.json({ galat: "Ticker tidak sah." }, { status: 400 });
  }

  const balas = (h: HasilOhlc | Gagal) =>
    "alasan" in h
      ? NextResponse.json({ galat: h.alasan }, { status: h.status })
      : NextResponse.json(h);

  if (jenis === "kripto") return balas(await ohlcKripto(ticker));

  const kunci = process.env.FINNHUB_API_KEY;
  if (!kunci) {
    return NextResponse.json(
      { galat: "FINNHUB_API_KEY belum diisi, OHLC saham tidak bisa diambil." },
      { status: 503 },
    );
  }
  return balas(await ohlcSaham(ticker, kunci));
}
