import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Cari ticker dari nama perusahaan atau nama koin.
 *
 * Sumbernya pencarian Yahoo, yang sama dengan sumber riwayat harga saham.
 * Memakai sumber yang sama membuat setiap hasil pencarian dijamin punya
 * data chart; daftar ticker buatan sendiri akan cepat basi dan menawarkan
 * simbol yang chartnya kosong.
 */

export interface HasilCari {
  ticker: string;
  nama: string;
  jenis: "saham" | "kripto";
  bursa: string;
}

/* Hanya bursa Amerika dan kripto. Selain itu harganya bukan dolar, dan
   route riwayat menolaknya, jadi menawarkannya di pencarian cuma membuat
   orang memilih sesuatu yang lalu gagal dimuat. */
const BURSA_AS = new Set(["NMS", "NGM", "NCM", "NYQ", "PCX", "ASE", "BTS", "PNK"]);

export async function GET(req: Request) {
  const kueri = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (kueri.length < 2) return NextResponse.json({ hasil: [] });

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(kueri)}&quotesCount=12&newsCount=0`,
      { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) {
      return NextResponse.json(
        { galat: r.status === 429 ? "Pencarian sedang dibatasi. Coba lagi semenit lagi." : "Pencarian gagal." },
        { status: r.status === 429 ? 429 : 502 },
      );
    }
    const j = (await r.json()) as {
      quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string }[];
    };

    const hasil: HasilCari[] = [];
    for (const q of j.quotes ?? []) {
      if (!q.symbol) continue;
      const nama = q.shortname ?? q.longname ?? q.symbol;
      if (q.quoteType === "CRYPTOCURRENCY") {
        // Yahoo memakai "BTC-USD"; app ini memakai tickernya saja.
        if (!q.symbol.endsWith("-USD")) continue;
        hasil.push({ ticker: q.symbol.slice(0, -4), nama, jenis: "kripto", bursa: "kripto" });
      } else if ((q.quoteType === "EQUITY" || q.quoteType === "ETF") && BURSA_AS.has(q.exchange ?? "")) {
        hasil.push({ ticker: q.symbol, nama, jenis: "saham", bursa: q.exchange ?? "" });
      }
    }
    return NextResponse.json({ hasil: hasil.slice(0, 8) }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ galat: "Tidak bisa menghubungi sumber pencarian." }, { status: 502 });
  }
}
