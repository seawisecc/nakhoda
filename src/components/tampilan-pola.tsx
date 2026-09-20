"use client";

import { useMemo, useState } from "react";
import { Loader2, Shapes } from "lucide-react";
import type { JenisAset } from "@/types";
import { cariBentuk, type Bentuk } from "@/lib/hitung/bentuk";
import { DAFTAR_SINYAL, kejadianSinyal } from "@/lib/hitung/sinyal";
import { kalimatKesimpulan, nilaiUji, ujiDariIndeks, type Penilaian } from "@/lib/hitung/uji-kejadian";
import { formatUang } from "@/lib/format";
import { useRiwayat } from "@/lib/riwayat";
import { Kartu, Kosong, Pilihan } from "@/components/ui/dasar";
import { ChartPenanda, type GarisChart } from "@/components/chart-penanda";
import { LencanaTingkat } from "@/components/tingkat";
import { cn } from "@/lib/cn";

const HORIZON = [1, 5, 10, 20] as const;

interface BentukDinilai {
  bentuk: Bentuk;
  nilai: Penilaian | null;
  kalimat: string | null;
}

/** Bentuk yang sedang ada di chart, digambar apa adanya.
 *
 *  Layar ini menjawab "apa yang sedang terbentuk", sementara Sinyal menjawab
 *  "apa yang baru saja terjadi". Keduanya dipisah karena bentuk yang sedang
 *  berlangsung tidak punya hasil yang bisa diukur: yang bisa diukur adalah
 *  penembusannya, dan angka itulah yang ditempelkan ke tiap bentuk di sini,
 *  diambil dari sinyal yang sama persis. */
export function TampilanPola({
  ticker, jenisAset, tema,
}: {
  ticker: string;
  jenisAset: JenisAset;
  tema: string;
}) {
  const { batang, sumber, memuat, galat } = useRiwayat(ticker, jenisAset);
  const [horizon, setHorizon] = useState<number>(5);
  const [pilihan, setPilihan] = useState<string | null>(null);

  const bentuk = useMemo(() => (batang ? cariBentuk(batang) : []), [batang]);

  const dinilai = useMemo<BentukDinilai[]>(() => {
    if (!batang) return [];
    return bentuk.map((b) => {
      const def = DAFTAR_SINYAL.find((d) => d.id === b.sinyalUji);
      if (!def) return { bentuk: b, nilai: null, kalimat: null };
      const uji = ujiDariIndeks(batang, kejadianSinyal(def.deteksi(batang), horizon), horizon);
      const nilai = nilaiUji(uji, DAFTAR_SINYAL.length, def.arah);
      return { bentuk: b, nilai, kalimat: kalimatKesimpulan(def.nama, ticker, uji, nilai, def.arah) };
    });
  }, [batang, bentuk, horizon, ticker]);

  const dipilih = pilihan ?? dinilai[0]?.bentuk.id ?? null;
  const terpilih = dinilai.find((d) => d.bentuk.id === dipilih) ?? null;

  const garis = useMemo<GarisChart[]>(
    () => terpilih?.bentuk.garis.map((g) => ({ titik: g.titik, putus: g.putus })) ?? [],
    [terpilih],
  );

  const berarti = dinilai.filter((d) => d.nilai?.tingkat === "catatan" && d.bentuk.pemicu);
  const ringkasan = !batang
    ? null
    : !bentuk.length
      ? `Tidak ada bentuk yang jelas di chart ${ticker} sekarang. Titik baliknya belum membentuk garis atau level yang bisa ditarik dengan aturan yang sama setiap kali.`
      : berarti.length
        ? `${berarti.length === 1 ? "Satu bentuk" : `${berarti.length} bentuk`} di sini punya penembusan yang teruji di ${ticker}: ${berarti.map((d) => d.bentuk.judul.toLowerCase()).join(", ")}. Itu levelnya yang layak dipantau; sisanya cuma gambar.`
        : `Ada ${bentuk.length} bentuk di chart ${ticker}, tapi tidak satu pun penembusannya punya catatan di ticker ini. Pakai levelnya untuk tahu di mana harga sedang ditahan, bukan sebagai alasan masuk.`;

  return (
    <div className="space-y-3">
      {ringkasan ? (
        <p className="kartu border-l-2 border-l-info px-4 py-3 text-[13px] leading-relaxed text-ink">{ringkasan}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="kartu relative h-[min(64vh,700px)] min-h-[380px] p-2">
          {batang ? (
            <ChartPenanda batang={batang} penanda={[]} garis={garis} tema={tema} />
          ) : (
            <div className="grid size-full place-items-center">
              {memuat ? (
                <Loader2 size={18} className="animate-spin text-ink-faint" />
              ) : (
                <Kosong judul="Riwayat harga tidak tersedia" keterangan={galat ?? undefined} />
              )}
            </div>
          )}
          {batang ? (
            <span className="label-mikro pointer-events-none absolute top-3 left-4 z-10 max-w-[calc(100%-6rem)] truncate">
              {ticker} · USD · {sumber}
              {terpilih ? ` · ${terpilih.bentuk.judul}` : ""}
            </span>
          ) : null}
        </div>

        <div className="kartu flex flex-col p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="label-mikro text-[11px] text-ink-soft">Bentuk sekarang</h2>
            <label className="flex items-center gap-2">
              <span className="label-mikro">Jendela</span>
              <Pilihan
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                aria-label="Jendela return"
                className="h-8 w-24 py-1"
              >
                {HORIZON.map((h) => (
                  <option key={h} value={h}>{h} sesi</option>
                ))}
              </Pilihan>
            </label>
          </div>

          {!batang ? (
            <p className="mt-3 text-[12px] text-ink-faint">—</p>
          ) : dinilai.length ? (
            <ul className="-mx-4 mt-3 divide-y divide-bordr border-y border-bordr">
              {dinilai.map((d) => {
                const aktif = d.bentuk.id === dipilih;
                return (
                  <li key={d.bentuk.id}>
                    <button
                      onClick={() => setPilihan(d.bentuk.id)}
                      aria-pressed={aktif}
                      className={cn(
                        "w-full space-y-2 px-4 py-3 text-left transition",
                        aktif ? "bg-surface-2" : "hover:bg-surface-2/60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{d.bentuk.judul}</span>
                        {d.nilai ? <LencanaTingkat tingkat={d.nilai.tingkat} searah={d.nilai.searah} /> : null}
                      </span>
                      <span className="block text-[12px] leading-relaxed text-ink-soft">
                        {d.bentuk.keterangan}
                      </span>
                      {d.bentuk.pemicu ? (
                        <span className="flex items-baseline justify-between gap-2 border border-bordr bg-surface px-2 py-1.5">
                          <span className="label-mikro">
                            Pemicu {d.bentuk.pemicu.arah === "naik" ? "ke atas" : "ke bawah"}
                          </span>
                          <span className="angka text-[12px] text-ink">
                            {formatUang(d.bentuk.pemicu.harga, "USD")}
                          </span>
                        </span>
                      ) : null}
                      {d.bentuk.pemicu ? (
                        <span className="block text-[11px] text-ink-faint">{d.bentuk.pemicu.kalimat}</span>
                      ) : null}
                      {d.kalimat ? (
                        <span className="block text-[11px] leading-relaxed text-ink-faint">
                          Catatan penembusannya: {d.kalimat}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3">
              <Kosong
                ikon={<Shapes size={18} />}
                judul="Belum ada bentuk"
                keterangan="Titik baliknya belum cukup untuk menarik garis atau level."
              />
            </div>
          )}
        </div>
      </div>

      <Kartu>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Bentuk ditarik dari titik balik yang sudah terkonfirmasi (lima sesi di kiri dan kanannya tidak
          melewatinya), bukan dari tarikan tangan, jadi kadang berbeda dengan yang akan kamu gambar sendiri.
          Bentuknya sendiri tidak diuji; yang diuji penembusannya, dan angkanya sama dengan yang ada di tab Sinyal.
        </p>
      </Kartu>
    </div>
  );
}
