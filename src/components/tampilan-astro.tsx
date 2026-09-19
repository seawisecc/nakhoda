"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { JenisAset } from "@/types";
import {
  ASPEK, DAFTAR_ASPEK, DAFTAR_PLANET, PLANET, cariSemuaAspek, indeksBatangSejak,
  tanggalUtc, ujiAspek, type JenisAspek, type KejadianAspek, type Planet,
} from "@/lib/hitung/astro";
import { formatPersen, tandaArah } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { Kartu, Kosong, Pilihan, warnaArah } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { ChartPenanda, type PenandaChart } from "@/components/chart-penanda";
import { LencanaTingkat } from "@/components/tingkat";
import { kalimatKesimpulan, nilaiUji } from "@/lib/hitung/uji-kejadian";
import { useRiwayat } from "@/lib/riwayat";
import { cn } from "@/lib/cn";

const HARI = 86_400_000;
const HORIZON = [1, 5, 10, 20] as const;

function label(k: Pick<KejadianAspek, "a" | "b" | "aspek">): string {
  return `${PLANET[k.a].simbol}${ASPEK[k.aspek].simbol}${PLANET[k.b].simbol}`;
}

/** Persen dengan arah yang tidak bergantung warna, sesuai aturan papan. */
function Arah({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="angka text-ink-faint">—</span>;
  const persen = nilai * 100;
  return (
    <span className={cn("angka", warnaArah(persen))}>
      <span aria-hidden>{tandaArah(persen)}</span> {formatPersen(Math.abs(persen), 2, false)}
    </span>
  );
}

/** Aspek planet di atas chart harga, lengkap dengan ujinya.
 *
 *  Penanda dan uji sengaja satu layar. Penanda saja membuat mata mencari
 *  aspek yang kebetulan jatuh di titik balik; tabel di bawahnya menghitung
 *  semua aspek, termasuk yang lewat tanpa kejadian apa pun. */
export function TampilanAstro({
  ticker, jenisAset, tema,
}: {
  ticker: string;
  jenisAset: JenisAset;
  tema: string;
}) {
  const { batang, sumber, memuat, galat } = useRiwayat(ticker, jenisAset);

  const [a, setA] = useState<Planet>("mars");
  const [b, setB] = useState<Planet>("jupiter");
  const [aktif, setAktif] = useState<Set<JenisAspek>>(() => new Set(DAFTAR_ASPEK));
  const [horizon, setHorizon] = useState<number>(5);
  const [terbuka, setTerbuka] = useState<JenisAspek | null>(null);
  // Dibekukan saat pasang. "Sekarang" yang bergerak di setiap render akan
  // menghitung ulang seluruh aspek tanpa ada yang berubah.
  const [sekarang] = useState(() => Date.now());

  const awal = batang?.length ? Date.parse(`${batang[0].tanggal}T00:00:00Z`) : null;

  const kejadian = useMemo(
    () => (awal === null ? [] : cariSemuaAspek(a, b, DAFTAR_ASPEK, awal, sekarang + 365 * HARI)),
    [a, b, awal, sekarang],
  );

  const penanda = useMemo<PenandaChart[]>(() => {
    if (!batang?.length) return [];
    // Aspek di akhir pekan ditaruh di sesi bursa berikutnya. Beberapa aspek
    // yang jatuh di sesi yang sama digabung jadi satu penanda, supaya
    // teksnya tidak saling tindih.
    const perTanggal = new Map<string, string[]>();
    for (const k of kejadian) {
      if (!aktif.has(k.aspek)) continue;
      const i = indeksBatangSejak(batang, tanggalUtc(k.waktu));
      if (i === -1) continue;
      const t = batang[i].tanggal;
      perTanggal.set(t, [...(perTanggal.get(t) ?? []), label(k)]);
    }
    return [...perTanggal].map(([tanggal, teks]) => ({ tanggal, teks: teks.join(" ") }));
  }, [batang, kejadian, aktif]);

  const hasilUji = useMemo(
    () => DAFTAR_ASPEK.map((x) => {
      const hasil = batang
        ? ujiAspek(batang, kejadian.filter((k) => k.aspek === x).map((k) => k.waktu), horizon)
        : null;
      // Aspek tidak mengklaim arah, jadi dinilai dua sisi. Lima aspek diuji
      // sekaligus di layar ini, dan itu yang jadi pembagi koreksinya.
      const nilai = hasil ? nilaiUji(hasil, DAFTAR_ASPEK.length) : null;
      const nama = `${PLANET[a].nama} ${ASPEK[x].nama.toLowerCase()} ${PLANET[b].nama}`;
      return {
        aspek: x, hasil, nilai,
        kalimat: hasil && nilai ? kalimatKesimpulan(nama, ticker, hasil, nilai) : null,
      };
    }),
    [batang, kejadian, horizon, a, b, ticker],
  );

  const akanDatang = kejadian.filter((k) => k.waktu > sekarang).slice(0, 8);
  const berarti = hasilUji.filter((u) => u.nilai?.tingkat === "catatan");
  const lemah = hasilUji.filter((u) => u.nilai?.tingkat === "lemah");
  const ringkasan = !batang
    ? null
    : berarti.length
      ? berarti.map((u) => u.kalimat).join(" ")
      : `Abaikan pasangan ini untuk ${ticker}. Tidak ada aspek ${PLANET[a].nama} dan ${PLANET[b].nama} yang hasilnya beda dari hari biasa${
        lemah.length ? `; ${lemah.map((u) => ASPEK[u.aspek].nama.toLowerCase()).join(" dan ")} cuma petunjuk lemah yang masih wajar muncul secara kebetulan` : ""
      }.`;

  const ubahAspek = (x: JenisAspek) =>
    setAktif((s) => {
      const baru = new Set(s);
      if (baru.has(x)) baru.delete(x);
      else baru.add(x);
      return baru;
    });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="kartu relative h-[min(70vh,760px)] min-h-[380px] p-2">
          {batang ? (
            <ChartPenanda batang={batang} penanda={penanda} tema={tema} />
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
            <span className="label-mikro pointer-events-none absolute top-3 left-4 z-10">
              {ticker} · USD · harian · {sumber}
            </span>
          ) : null}
        </div>

        <div className="kartu flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="label-mikro">Planet A</span>
              <Pilihan value={a} onChange={(e) => setA(e.target.value as Planet)} className="h-9 py-1.5">
                {DAFTAR_PLANET.map((p) => (
                  <option key={p} value={p} disabled={p === b}>
                    {PLANET[p].simbol} {PLANET[p].nama}
                  </option>
                ))}
              </Pilihan>
            </label>
            <label className="space-y-1">
              <span className="label-mikro">Planet B</span>
              <Pilihan value={b} onChange={(e) => setB(e.target.value as Planet)} className="h-9 py-1.5">
                {DAFTAR_PLANET.map((p) => (
                  <option key={p} value={p} disabled={p === a}>
                    {PLANET[p].simbol} {PLANET[p].nama}
                  </option>
                ))}
              </Pilihan>
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="label-mikro">Aspek di chart</span>
            <div className="flex flex-wrap gap-1.5">
              {DAFTAR_ASPEK.map((x) => {
                const nyala = aktif.has(x);
                return (
                  <button
                    key={x}
                    onClick={() => ubahAspek(x)}
                    aria-pressed={nyala}
                    className={cn(
                      "border px-2 py-1 font-mono text-[11px] tracking-[0.06em] uppercase transition",
                      nyala
                        ? "border-info/40 bg-surface-2 text-info"
                        : "border-bordr text-ink-faint hover:border-bordr-strong hover:text-ink-soft",
                    )}
                  >
                    {ASPEK[x].simbol} {ASPEK[x].nama}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <span className="label-mikro">Akan datang</span>
            {akanDatang.length ? (
              <ul className="mt-1.5 divide-y divide-bordr border-y border-bordr text-[12px]">
                {akanDatang.map((k) => (
                  <li key={`${k.aspek}-${k.waktu}`} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span className="text-ink-soft">
                      <span className="font-mono text-info">{label(k)}</span> {ASPEK[k.aspek].nama}
                    </span>
                    <span className="angka text-ink-faint">{formatTanggal(tanggalUtc(k.waktu))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {batang ? "Tidak ada aspek dalam 12 bulan ke depan." : "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      <Kartu>
        {ringkasan ? (
          <p className="mb-4 border-l-2 border-info pl-3 text-[13px] leading-relaxed text-ink">{ringkasan}</p>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-mikro text-[11px] text-ink-soft">
            Uji {PLANET[a].nama} · {PLANET[b].nama}
          </h2>
          <label className="flex items-center gap-2">
            <span className="label-mikro">Jendela</span>
            <Pilihan
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              aria-label="Jendela return"
              className="h-8 w-28 py-1"
            >
              {HORIZON.map((h) => (
                <option key={h} value={h}>{h} sesi</option>
              ))}
            </Pilihan>
          </label>
        </div>

        <Tabel
          kepala={
            <>
              <Th>Aspek</Th>
              <Th kanan>Kejadian</Th>
              <Th kanan>Rata-rata</Th>
              <Th kanan>Hari acak</Th>
              <Th kanan>Naik</Th>
              <Th kanan>Peluang kebetulan</Th>
              <Th kanan>Kesimpulan</Th>
            </>
          }
        >
          {hasilUji.map(({ aspek, hasil, nilai, kalimat }) => {
            const buka = terbuka === aspek;
            return (
              <Fragment key={aspek}>
                <Tr
                  className="cursor-pointer"
                  onClick={() => setTerbuka(buka ? null : aspek)}
                  aria-expanded={buka}
                >
                  <Td>
                    <span className="flex items-center gap-1.5 text-ink">
                      {buka ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span className="font-mono text-info">{label({ a, b, aspek })}</span>
                      {ASPEK[aspek].nama}
                    </span>
                  </Td>
                  <Td kanan><span className="angka">{hasil?.kejadian.length ?? "—"}</span></Td>
                  <Td kanan><Arah nilai={hasil?.rataRata ?? null} /></Td>
                  <Td kanan><Arah nilai={hasil?.dasar?.rataRata ?? null} /></Td>
                  <Td kanan>
                    <span className="angka">
                      {hasil?.persenNaik != null ? formatPersen(hasil.persenNaik, 0, false) : "—"}
                      {hasil?.dasar ? (
                        <span className="text-ink-faint"> / {formatPersen(hasil.dasar.persenNaik, 0, false)}</span>
                      ) : null}
                    </span>
                  </Td>
                  <Td kanan>
                    {!hasil || !hasil.kejadian.length ? (
                      <span className="angka text-ink-faint">—</span>
                    ) : (
                      <span className="angka">
                        {hasil.peluangKebetulan === null ? "—" : formatPersen(hasil.peluangKebetulan * 100, 0, false)}
                      </span>
                    )}
                  </Td>
                  <Td kanan>{nilai ? <LencanaTingkat tingkat={nilai.tingkat} /> : "—"}</Td>
                </Tr>
                {buka && hasil ? (
                  <tr className="border-b border-bordr bg-surface-2">
                    <td colSpan={7} className="px-3 py-2">
                      {kalimat ? <p className="mb-2 text-[12px] text-ink">{kalimat}</p> : null}
                      {hasil.kejadian.length ? (
                        <ul className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
                          {hasil.kejadian.map((k) => (
                            <li key={k.waktuAspek} className="flex justify-between gap-3">
                              <span className="angka text-ink-soft">{formatTanggal(tanggalUtc(k.waktuAspek))}</span>
                              <Arah nilai={k.hasil} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[12px] text-ink-faint">Tidak ada kejadian dalam rentang data.</p>
                      )}
                      {hasil.terlewat ? (
                        <p className="mt-1.5 text-[11px] text-ink-faint">
                          {hasil.terlewat} kejadian belum punya jendela {hasil.horizon} sesi yang lengkap.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </Tabel>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Return dari tutup sebelum hari aspek sampai {horizon} sesi sesudahnya, dibanding {horizon} sesi dari
          hari mana pun. Klik baris untuk rinciannya.
        </p>
      </Kartu>
    </div>
  );
}
