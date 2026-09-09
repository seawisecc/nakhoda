import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kurs USD ke IDR.
 *
 *  Dua sumber, keduanya gratis dan tanpa kunci. Frankfurter dipakai sebagai
 *  cadangan karena kalau satu-satunya sumber kurs mati, seluruh angka gabungan
 *  IDR+USD di dashboard ikut salah, bukan sekadar satu kartu kosong. */
async function dariErApi(): Promise<number | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
    const kurs = j.rates?.IDR;
    return j.result === "success" && typeof kurs === "number" && kurs > 0 ? kurs : null;
  } catch {
    return null;
  }
}

async function dariFrankfurter(): Promise<number | null> {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: Record<string, number> };
    const kurs = j.rates?.IDR;
    return typeof kurs === "number" && kurs > 0 ? kurs : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const utama = await dariErApi();
  if (utama) {
    return NextResponse.json({ kurs: utama, sumber: "er-api", waktu: Date.now() });
  }
  const cadangan = await dariFrankfurter();
  if (cadangan) {
    return NextResponse.json({ kurs: cadangan, sumber: "frankfurter", waktu: Date.now() });
  }
  return NextResponse.json(
    { galat: "Kedua sumber kurs tidak bisa dihubungi." },
    { status: 502 },
  );
}
