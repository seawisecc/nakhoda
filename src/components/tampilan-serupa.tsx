"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { JenisAset } from "@/types";
import { JUMLAH_SERUPA, KORELASI_MIN, PANJANG_SERUPA, cariSerupa } from "@/lib/hitung/serupa";
import { kalimatKesimpulan, nilaiUji, ujiDariIndeks } from "@/lib/hitung/uji-kejadian";
import { formatAngka, formatPersen, tandaArah } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { useRiwayat } from "@/lib/riwayat";
import { Kartu, Kosong, Pilihan, warnaArah } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { ChartPenanda, type GarisChart, type PenandaChart } from "@/components/chart-penanda";
import { LencanaTingkat } from "@/components/tingkat";
import { HORIZON } from "@/components/tampilan-sinyal";
import { cn } from "@/lib/cn";

/** Bentuk 20 sesi terakhir dicari di riwayat ticker yang sama, lalu apa
 *  yang terjadi sesudah setiap kecocokan dibandingkan dengan hari biasa.
 *
 *  Tidak ada tombol saran di sini. Pola serupa tidak mengklaim arah apa pun,
 *  jadi tidak ada stop yang bisa diturunkan darinya; yang bisa dia katakan
 *  cuma apakah masa lalu bentuk ini berbeda dari hari biasa. */
export function TampilanSerupa({
  ticker, jenisAset, tema,
}: {
  ticker: string;
  jenisAset: JenisAset;
  tema: string;
}) {
  const { batang, sumber, memuat, galat } = useRiwayat(ticker, jenisAset);
  const [horizon, setHorizon] = useState<number>(10);
  const [pilihan, setPilihan] = useState<number | null>(null);

  // Pencocokan tidak bergantung pada horizon, jadi mengganti jendela tidak
  // mengubah daftar kecocokannya, cuma hasil yang dibaca sesudahnya.
  const serupa = useMemo(() => (batang ? cariSerupa(batang) : null), [batang]);

  const uji = useMemo(
    () => (batang && serupa ? ujiDariIndeks(batang, serupa.cocok.map((c) => c.akhir), horizon) : null),
    [batang, serupa, horizon],
  );
  // Satu uji di layar ini. Panjang dan jumlah kecocokan sengaja tidak bisa
  // diubah, supaya jumlah ujinya memang satu.
  const nilai = uji ? nilaiUji(uji, 1) : null;
  const nama = `Bentuk ${PANJANG_SERUPA} sesi seperti sekarang`;

  const hasilPer = useMemo(
    () => new Map(uji?.kejadian.map((k) => [k.tanggalMasuk, k.hasil]) ?? []),
    [uji],
  );

  const dipilih = pilihan ?? serupa?.cocok[0]?.akhir ?? null;

  const penanda = useMemo<PenandaChart[]>(() => {
    if (!batang || !serupa) return [];
    return [...serupa.cocok]
      .sort((p, q) => p.akhir - q.akhir)
      .map((c) => {
        const r = hasilPer.get(batang[c.akhir].tanggal);
        return {
          tanggal: batang[c.akhir].tanggal,
          teks: r !== undefined ? formatPersen(r * 100, 1) : "",
          warna: r === undefined ? "netral" : r > 0 ? "naik" : r < 0 ? "turun" : "netral",
        };
      });
  }, [batang, serupa, hasilPer]);

  // Dua garis: potongan acuan (sekarang) dan kecocokan yang dipilih. Mata
  // yang membandingkan keduanya langsung melihat seberapa "mirip" korelasi
  // 0,85 itu sebenarnya.
  const garis = useMemo<GarisChart[]>(() => {
    if (!batang || !serupa) return [];
    const potong = (dari: number, sampai: number) =>
      batang.slice(dari, sampai + 1).map((x) => ({ tanggal: x.tanggal, harga: x.tutup }));
    const g: GarisChart[] = [{ titik: potong(serupa.acuanDari, serupa.acuanSampai) }];
    if (dipilih !== null) g.push({ titik: potong(dipilih - PANJANG_SERUPA + 1, dipilih), putus: true });
    return g;
  }, [batang, serupa, dipilih]);

  let ringkasan: string | null = null;
  if (batang) {
    if (!serupa) {
      ringkasan = `Riwayat ${ticker} terlalu pendek, atau ${PANJANG_SERUPA} sesi terakhirnya datar, jadi tidak ada bentuk yang bisa dicari.`;
    } else if (!serupa.cocok.length) {
      ringkasan = `Tidak ada potongan di riwayat ${ticker} yang bentuknya cukup mirip dengan ${PANJANG_SERUPA} sesi terakhir (korelasi minimal ${formatAngka(KORELASI_MIN, 1)}). Bentuk sekarang tidak punya pembanding.`;
    } else if (uji && nilai) {
      ringkasan = kalimatKesimpulan(nama, ticker, uji, nilai);
    }
  }

  return (
    <div className="space-y-3">
      {ringkasan ? (
        <p className="kartu border-l-2 border-l-info px-4 py-3 text-[13px] leading-relaxed text-ink">{ringkasan}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="kartu relative h-[min(64vh,700px)] min-h-[380px] p-2">
          {batang ? (
            <ChartPenanda batang={batang} penanda={penanda} garis={garis} tema={tema} />
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
              {ticker} · USD · {sumber} · garis penuh sekarang, putus-putus kecocokan
            </span>
          ) : null}
        </div>

        <Kartu className="flex flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="label-mikro text-[11px] text-ink-soft">
              Kecocokan {serupa ? serupa.cocok.length : "—"} dari {JUMLAH_SERUPA}
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

          {uji && nilai && serupa?.cocok.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
              <LencanaTingkat tingkat={nilai.tingkat} />
              <span className="text-ink-faint">
                Rata-rata <Persen nilai={uji.rataRata} />
              </span>
              <span className="text-ink-faint">
                Hari biasa <Persen nilai={uji.dasar?.rataRata ?? null} />
              </span>
            </div>
          ) : null}

          {serupa?.cocok.length ? (
            <Tabel
              className="min-w-0"
              kepala={
                <>
                  <Th>Berakhir</Th>
                  <Th kanan>Mirip</Th>
                  <Th kanan>{horizon} sesi sesudah</Th>
                </>
              }
            >
              {serupa.cocok.map((c) => {
                const r = hasilPer.get(batang![c.akhir].tanggal);
                return (
                  <Tr
                    key={c.akhir}
                    className={cn("cursor-pointer", dipilih === c.akhir && "bg-surface-2")}
                    onClick={() => setPilihan(c.akhir)}
                  >
                    <Td>{formatTanggal(batang![c.akhir].tanggal)}</Td>
                    <Td kanan><span className="angka">{formatAngka(c.korelasi, 2)}</span></Td>
                    <Td kanan><Persen nilai={r ?? null} /></Td>
                  </Tr>
                );
              })}
            </Tabel>
          ) : (
            <p className="text-[12px] text-ink-faint">—</p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Bentuk {PANJANG_SERUPA} sesi terakhir dibandingkan dengan setiap potongan {PANJANG_SERUPA} sesi di
            riwayat {ticker}, setelah harganya dinormalkan. Kecocokan tidak saling tumpang tindih. Klik baris
            untuk menggambarnya di chart.
          </p>
        </Kartu>
      </div>
    </div>
  );
}

function Persen({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="angka text-ink-faint">—</span>;
  const persen = nilai * 100;
  return (
    <span className={cn("angka", warnaArah(persen))}>
      <span aria-hidden>{tandaArah(persen)}</span> {formatPersen(Math.abs(persen), 2, false)}
    </span>
  );
}
