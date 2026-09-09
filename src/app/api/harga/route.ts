import { NextResponse } from "next/server";
import { ID_KRIPTO } from "@/lib/kripto-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Pengambilan harga.
 *
 * Rutenya ada di server, bukan di klien, karena dua alasan. Pertama, kunci
 * Finnhub tidak boleh ikut terkirim ke browser. Kedua, CoinGecko dan Finnhub
 * tidak selalu mengizinkan permintaan lintas asal dari browser, dan kegagalan
 * CORS muncul sebagai galat jaringan yang membingungkan.
 *
 * Ini dipanggil manual atau saat app dibuka, bukan polling. Finnhub gratis
 * membatasi 60 permintaan per menit; satu portofolio berisi belasan ticker
 * jauh di bawah itu selama tidak dipanggil berulang-ulang. */

interface Permintaan {
  saham?: string[];
  kripto?: string[];
  /** Mata uang kutipan kripto. Saham AS selalu dikutip dalam USD. */
  mataUangKripto?: "IDR" | "USD";
}

export interface HargaHasil {
  ticker: string;
  jenisAset: "saham" | "kripto";
  harga: number;
  mataUang: "IDR" | "USD";
  sumber: string;
}

const BATAS_TICKER = 60;

async function hargaSaham(ticker: string, kunci: string): Promise<HargaHasil | null> {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${kunci}`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { c?: number };
    // Finnhub membalas 200 dengan c = 0 untuk simbol yang tidak dikenal, jadi
    // status HTTP saja tidak cukup untuk menyatakan berhasil.
    if (typeof j.c !== "number" || j.c <= 0) return null;
    return { ticker, jenisAset: "saham", harga: j.c, mataUang: "USD", sumber: "finnhub" };
  } catch {
    return null;
  }
}

async function cariIdKripto(ticker: string): Promise<string | null> {
  const tetap = ID_KRIPTO[ticker];
  if (tetap) return tetap;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`,
      { next: { revalidate: 86_400 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { coins?: { id: string; symbol: string; market_cap_rank: number | null }[] };
    const cocok = (j.coins ?? [])
      .filter((c) => c.symbol?.toUpperCase() === ticker)
      .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9));
    return cocok[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function hargaKripto(
  tickers: string[],
  mataUang: "IDR" | "USD",
): Promise<HargaHasil[]> {
  const pasangan = await Promise.all(
    tickers.map(async (t) => ({ ticker: t, id: await cariIdKripto(t) })),
  );
  const dikenal = pasangan.filter((p): p is { ticker: string; id: string } => Boolean(p.id));
  if (!dikenal.length) return [];

  const vs = mataUang.toLowerCase();
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${
        encodeURIComponent([...new Set(dikenal.map((d) => d.id))].join(","))
      }&vs_currencies=${vs}`,
      { cache: "no-store" },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as Record<string, Record<string, number>>;
    const hasil: HargaHasil[] = [];
    for (const { ticker, id } of dikenal) {
      const harga = j[id]?.[vs];
      if (typeof harga !== "number" || harga <= 0) continue;
      hasil.push({ ticker, jenisAset: "kripto", harga, mataUang, sumber: "coingecko" });
    }
    return hasil;
  } catch {
    return [];
  }
}

/** Menjalankan tugas beberapa sekaligus, tapi tidak semuanya sekaligus.
 *  Menembakkan 40 permintaan Finnhub serentak adalah cara tercepat kena
 *  pembatasan laju dan pulang dengan tangan kosong. */
async function berbaris<T, H>(
  item: T[],
  lebar: number,
  kerja: (x: T) => Promise<H>,
): Promise<H[]> {
  const hasil: H[] = [];
  for (let i = 0; i < item.length; i += lebar) {
    hasil.push(...(await Promise.all(item.slice(i, i + lebar).map(kerja))));
  }
  return hasil;
}

export async function POST(req: Request) {
  let badan: Permintaan;
  try {
    badan = (await req.json()) as Permintaan;
  } catch {
    return NextResponse.json({ galat: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const bersihkan = (xs?: string[]) =>
    [...new Set((xs ?? []).map((t) => String(t).trim().toUpperCase()).filter(Boolean))]
      .slice(0, BATAS_TICKER);

  const saham = bersihkan(badan.saham);
  const kripto = bersihkan(badan.kripto);
  const mataUangKripto = badan.mataUangKripto === "IDR" ? "IDR" : "USD";

  const kunciFinnhub = process.env.FINNHUB_API_KEY;
  const peringatan: string[] = [];

  const [hasilSaham, hasilKripto] = await Promise.all([
    (async () => {
      if (!saham.length) return [];
      if (!kunciFinnhub) {
        peringatan.push(
          "FINNHUB_API_KEY belum diisi di .env.local, jadi harga saham tidak bisa diambil.",
        );
        return [];
      }
      const r = await berbaris(saham, 5, (t) => hargaSaham(t, kunciFinnhub));
      return r.filter((x): x is HargaHasil => x !== null);
    })(),
    kripto.length ? hargaKripto(kripto, mataUangKripto) : Promise.resolve([]),
  ]);

  const harga = [...hasilSaham, ...hasilKripto];
  const gagal = [...saham, ...kripto].filter((t) => !harga.some((h) => h.ticker === t));
  if (gagal.length) {
    peringatan.push(`Harga tidak ditemukan untuk: ${gagal.join(", ")}.`);
  }

  return NextResponse.json({ harga, peringatan, waktu: Date.now() });
}
