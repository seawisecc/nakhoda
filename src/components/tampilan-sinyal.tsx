"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import type { JenisAset, Saran } from "@/types";
import {
  DAFTAR_SINYAL, kejadianSinyal, levelSinyal, type DefinisiSinyal, type LevelSinyal,
} from "@/lib/hitung/sinyal";
import {
  kalimatKesimpulan, nilaiUji, ujiDariIndeks, type HasilUji, type Penilaian,
} from "@/lib/hitung/uji-kejadian";
import { tanggalUtc } from "@/lib/hitung/astro";
import { formatAngka, formatPersen, formatUang, tandaArah } from "@/lib/format";
import { formatTanggal, hariIni } from "@/lib/tanggal";
import { useData, buatId } from "@/lib/data/penyedia";
import { useRiwayat } from "@/lib/riwayat";
import { Kartu, Kosong, Pilihan, Tombol, warnaArah } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { ChartPenanda, type PenandaChart } from "@/components/chart-penanda";
import { LencanaTingkat } from "@/components/tingkat";
import { cn } from "@/lib/cn";

const HORIZON = [1, 5, 10, 20] as const;
/** Pola yang selesai dalam tiga sesi terakhir masih dianggap aktif. Lebih
 *  lama dari itu, harganya sudah bergerak dan entry-nya bukan lagi entry
 *  yang diuji. */
const JENDELA_AKTIF = 3;
const RR_MIN = 1.5;

interface HasilSinyal {
  def: DefinisiSinyal;
  kejadian: number[];
  uji: HasilUji;
  nilai: Penilaian;
  kalimat: string;
  /** Indeks kemunculan terakhir di jendela aktif, atau null. */
  aktifDi: number | null;
  level: LevelSinyal | null;
}

function Arah({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="angka text-ink-faint">—</span>;
  const persen = nilai * 100;
  return (
    <span className={cn("angka", warnaArah(persen))}>
      <span aria-hidden>{tandaArah(persen)}</span> {formatPersen(Math.abs(persen), 2, false)}
    </span>
  );
}

function PanahArah({ arah }: { arah: "naik" | "turun" }) {
  return (
    <span className={arah === "naik" ? "text-naik" : "text-turun"} title={`Pola ${arah}`}>
      {arah === "naik" ? "▲" : "▼"}
    </span>
  );
}

function susunSaran(
  h: HasilSinyal, ticker: string, jenisAset: JenisAset, horizon: number, uid: string,
): Saran | null {
  if (!h.level) return null;
  const naik = h.def.arah === "naik";
  return {
    id: buatId(),
    uid,
    ticker,
    jenisAset,
    tanggal: hariIni(),
    sumber: "sinyal",
    rekomendasi: naik ? "beli" : "jual",
    catatanTeknikal: `${h.def.nama} (${h.def.keterangan}) ${h.kalimat}`,
    catatanFundamental: "Tidak dinilai. Saran ini murni dari catatan pola di ticker ini.",
    entrySaran: h.level.entry,
    stopSaran: h.level.stop,
    targetSaran: h.level.target,
    pembatalThesis: `Tutup harian ${naik ? "di bawah" : "di atas"} ${formatAngka(h.level.stop, 2)} USD, titik ${naik ? "terendah" : "tertinggi"} polanya.`,
    // Horizon uji dihitung dalam sesi bursa. Saham punya lima sesi
    // seminggu, kripto tujuh, jadi harinya dikonversi berbeda.
    horizonHari: jenisAset === "kripto" ? horizon : Math.ceil((horizon * 7) / 5),
    rujukan: [`https://nakhoda.seawise.id/chart?ticker=${encodeURIComponent(ticker)}&jenis=${jenisAset}`],
    // Riwayat selalu USD, jadi levelnya juga USD, termasuk untuk kripto
    // yang posisinya dicatat dalam rupiah.
    mataUang: "USD",
    status: "menunggu",
    dibuatPada: Date.now(),
  };
}

/** Pola chart dan indikator, masing-masing diuji di ticker ini sendiri.
 *
 *  Layarnya menjawab satu pertanyaan dulu: ada yang perlu dilakukan atau
 *  tidak. Tabel lengkapnya di bawah, untuk yang ingin melihat alasannya.
 *  Satu-satunya jalan ke saran adalah pola yang lolos uji dengan koreksi
 *  uji ganda DAN punya R:R minimal 1,5; aturan yang sama yang ditegakkan
 *  scripts/tambah-saran.ts. */
export function TampilanSinyal({
  ticker, jenisAset, tema, dipegang,
}: {
  ticker: string;
  jenisAset: JenisAset;
  tema: string;
  dipegang: boolean;
}) {
  const { batang, sumber, memuat, galat } = useRiwayat(ticker, jenisAset);
  const { simpan, pengguna } = useData();
  const [horizon, setHorizon] = useState<number>(5);
  const [pilihan, setPilihan] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState<Set<string>>(() => new Set());
  const [sekarang] = useState(() => Date.now());

  // Deteksi tidak bergantung pada horizon, jadi dipisah supaya mengganti
  // jendela tidak mengulang pemindaian 17 pola atas sepuluh tahun data.
  const deteksi = useMemo(
    () => (batang ? DAFTAR_SINYAL.map((d) => d.deteksi(batang)) : null),
    [batang],
  );

  const hasil = useMemo<HasilSinyal[]>(() => {
    if (!batang || !deteksi) return [];
    return DAFTAR_SINYAL.map((def, k) => {
      const kejadian = kejadianSinyal(deteksi[k], horizon);
      const uji = ujiDariIndeks(batang, kejadian, horizon);
      const nilai = nilaiUji(uji, DAFTAR_SINYAL.length, def.arah);
      let aktifDi: number | null = null;
      for (let i = batang.length - 1; i >= batang.length - JENDELA_AKTIF && i >= 0; i -= 1) {
        if (deteksi[k][i]) {
          aktifDi = i;
          break;
        }
      }
      const level = aktifDi !== null && nilai.tingkat === "catatan" && nilai.searah
        ? levelSinyal(batang, aktifDi, def, uji.median)
        : null;
      return {
        def, kejadian, uji, nilai, aktifDi, level,
        kalimat: kalimatKesimpulan(def.nama, ticker, uji, nilai, def.arah),
      };
    });
  }, [batang, deteksi, horizon, ticker]);

  const aktif = hasil.filter((h) => h.aktifDi !== null);
  // Pilihan bawaan: tanda aktif pertama, supaya chart langsung menunjukkan
  // yang sedang relevan tanpa harus diklik dulu.
  const dipilih = pilihan ?? aktif[0]?.def.id ?? null;
  const terpilih = hasil.find((h) => h.def.id === dipilih) ?? null;

  const penanda = useMemo<PenandaChart[]>(() => {
    if (!batang || !terpilih) return [];
    const indeks = new Set(terpilih.kejadian);
    if (terpilih.aktifDi !== null) indeks.add(terpilih.aktifDi);
    return [...indeks].sort((p, q) => p - q).map((i) => ({
      tanggal: batang[i].tanggal,
      teks: "",
      arah: terpilih.def.arah,
    }));
  }, [batang, terpilih]);

  const lilinBerjalan = !!batang?.length && batang[batang.length - 1].tanggal >= tanggalUtc(sekarang);
  const layak = aktif.filter(
    (h) => h.level && h.level.rr >= RR_MIN && (h.def.arah === "naik" || dipegang),
  );

  let ringkasan: string | null = null;
  if (batang) {
    if (layak.length) {
      ringkasan = `${layak.length === 1 ? "Ada satu tanda" : `Ada ${layak.length} tanda`} yang lolos uji di ${ticker} dan punya R:R minimal ${formatAngka(RR_MIN, 1)}: ${layak.map((h) => h.def.nama).join(", ")}. Lihat levelnya di panel kanan.`;
    } else if (aktif.length) {
      ringkasan = `Tidak ada yang perlu dilakukan dari chart ini. Tanda yang muncul di ${JENDELA_AKTIF} sesi terakhir (${aktif.map((h) => h.def.nama).join(", ")}) tidak punya catatan yang cukup di ${ticker}.`;
    } else {
      ringkasan = `Tidak ada yang perlu dilakukan dari chart ini. Tidak satu pun dari ${DAFTAR_SINYAL.length} pola muncul di ${JENDELA_AKTIF} sesi terakhir.`;
    }
  }

  async function jadikanSaran(h: HasilSinyal) {
    const dok = susunSaran(h, ticker, jenisAset, horizon, pengguna?.uid ?? "lokal");
    if (!dok) return;
    await simpan("saran", dok);
    setTersimpan((s) => new Set(s).add(h.def.id));
  }

  return (
    <div className="space-y-3">
      {ringkasan ? (
        <p className="kartu border-l-2 border-l-info px-4 py-3 text-[13px] leading-relaxed text-ink">{ringkasan}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="kartu relative h-[min(64vh,700px)] min-h-[380px] p-2">
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
            <span className="label-mikro pointer-events-none absolute top-3 left-4 z-10 max-w-[calc(100%-6rem)] truncate">
              {ticker} · USD · {sumber}
              {terpilih ? ` · ${terpilih.def.nama}` : ""}
            </span>
          ) : null}
        </div>

        <div className="kartu flex flex-col p-4">
          <h2 className="label-mikro text-[11px] text-ink-soft">Sinyal {JENDELA_AKTIF} sesi terakhir</h2>
          {lilinBerjalan ? (
            <p className="mt-1 text-[11px] text-peringatan">Lilin terakhir belum tutup; polanya bisa berubah.</p>
          ) : null}
          {!batang ? (
            <p className="mt-3 text-[12px] text-ink-faint">—</p>
          ) : aktif.length ? (
            <ul className="mt-3 -mx-4 divide-y divide-bordr border-y border-bordr">
              {aktif.map((h) => {
                const umur = batang.length - 1 - h.aktifDi!;
                const bisaDisaran = h.level && h.level.rr >= RR_MIN && (h.def.arah === "naik" || dipegang);
                return (
                  <li key={h.def.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setPilihan(h.def.id)}
                        className="flex items-center gap-1.5 text-left text-[13px] font-medium text-ink hover:underline"
                      >
                        <PanahArah arah={h.def.arah} /> {h.def.nama}
                      </button>
                      <LencanaTingkat tingkat={h.nilai.tingkat} searah={h.nilai.searah} />
                    </div>
                    <p className="label-mikro">
                      {umur === 0 ? "sesi terakhir" : `${umur} sesi lalu`} · {formatTanggal(batang[h.aktifDi!].tanggal)}
                    </p>
                    <p className="text-[12px] leading-relaxed text-ink-soft">{h.kalimat}</p>

                    {h.level ? (
                      <div className="jala grid-cols-4 border border-bordr">
                        {([
                          ["Entry", formatUang(h.level.entry, "USD"), "text-ink"],
                          ["Stop", formatUang(h.level.stop, "USD"), "text-turun"],
                          ["Target", formatUang(h.level.target, "USD"), "text-naik"],
                          ["R:R", formatAngka(h.level.rr, 2), h.level.rr >= RR_MIN ? "text-ink" : "text-peringatan"],
                        ] as const).map(([l, v, w]) => (
                          <div key={l} className="bg-surface px-2 py-1.5">
                            <p className="label-mikro">{l}</p>
                            <p className={cn("angka text-[12px]", w)}>{v}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {h.level && h.level.rr < RR_MIN ? (
                      <p className="text-[11px] text-ink-faint">
                        R:R di bawah {formatAngka(RR_MIN, 1)}: gerak khasnya terlalu kecil dibanding jarak ke stop.
                      </p>
                    ) : null}
                    {h.level && h.def.arah === "turun" && !dipegang ? (
                      <p className="text-[11px] text-ink-faint">
                        Kamu tidak memegang {ticker}. Tanda turun di sini cuma berarti jangan beli dulu.
                      </p>
                    ) : null}
                    {bisaDisaran ? (
                      tersimpan.has(h.def.id) ? (
                        <p className="flex items-center gap-1.5 text-[12px] text-info">
                          <Check size={14} /> Tersimpan di Saran
                        </p>
                      ) : (
                        <Tombol onClick={() => jadikanSaran(h)} className="w-full justify-center">
                          <Plus size={14} /> Jadikan saran {h.def.arah === "naik" ? "beli" : "jual"}
                        </Tombol>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-ink-faint">Tidak ada pola yang muncul.</p>
          )}
        </div>
      </div>

      <Kartu>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-mikro text-[11px] text-ink-soft">Catatan {DAFTAR_SINYAL.length} pola di {ticker}</h2>
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
              <Th>Pola</Th>
              <Th kanan>Kejadian</Th>
              <Th kanan>Rata-rata</Th>
              <Th kanan>Hari biasa</Th>
              <Th kanan>Naik</Th>
              <Th kanan>Kesimpulan</Th>
            </>
          }
        >
          {hasil.map((h) => {
            const buka = dipilih === h.def.id;
            return (
              <Fragment key={h.def.id}>
                <Tr
                  className={cn("cursor-pointer", buka && "bg-surface-2")}
                  onClick={() => setPilihan(buka ? "" : h.def.id)}
                  aria-expanded={buka}
                >
                  <Td>
                    <span className="flex items-center gap-1.5 text-ink">
                      {buka ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <PanahArah arah={h.def.arah} />
                      {h.def.nama}
                      {h.aktifDi !== null ? <span className="label-mikro text-info">aktif</span> : null}
                    </span>
                  </Td>
                  <Td kanan><span className="angka">{h.uji.kejadian.length}</span></Td>
                  <Td kanan><Arah nilai={h.uji.rataRata} /></Td>
                  <Td kanan><Arah nilai={h.uji.dasar?.rataRata ?? null} /></Td>
                  <Td kanan>
                    <span className="angka">
                      {h.uji.persenNaik !== null ? formatPersen(h.uji.persenNaik, 0, false) : "—"}
                      {h.uji.dasar ? (
                        <span className="text-ink-faint"> / {formatPersen(h.uji.dasar.persenNaik, 0, false)}</span>
                      ) : null}
                    </span>
                  </Td>
                  <Td kanan><LencanaTingkat tingkat={h.nilai.tingkat} searah={h.nilai.searah} /></Td>
                </Tr>
                {buka ? (
                  <tr className="border-b border-bordr bg-surface-2">
                    <td colSpan={6} className="space-y-1 px-3 py-2 text-[12px]">
                      <p className="text-ink-faint">{h.def.keterangan}</p>
                      <p className="text-ink">{h.kalimat}</p>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </Tabel>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Return dari tutup lilin pola sampai {horizon} sesi sesudahnya, dibanding {horizon} sesi dari hari mana pun.
          Klik baris untuk melihat kemunculannya di chart.
        </p>
      </Kartu>
    </div>
  );
}
