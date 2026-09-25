"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, ScanSearch } from "lucide-react";
import type { JenisAset } from "@/types";
import { DAFTAR_SINYAL, type Lilin } from "@/lib/hitung/sinyal";
import { JENDELA_AKTIF, RR_MIN, evaluasiSinyal, ringkasPindai } from "@/lib/hitung/evaluasi-sinyal";
import { formatAngka } from "@/lib/format";
import { tindakanPindai } from "@/lib/hitung/narasi";
import { ambilRiwayat } from "@/lib/riwayat";
import { Kartu, Kosong, Pilihan } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { LencanaTingkat } from "@/components/tingkat";
import { HORIZON, PanahArah } from "@/components/tampilan-sinyal";

interface Target { ticker: string; jenisAset: JenisAset }

type Muatan =
  | { status: "memuat" }
  | { status: "galat"; galat: string }
  | { status: "siap"; batang: Lilin[]; deteksi: boolean[][] };

/** Dua permintaan sekaligus, bukan semuanya. Yahoo membalas 429 kalau
 *  dihujani dari satu IP, dan satu posisi yang gagal karena itu lebih
 *  menyesatkan daripada pemindaian yang selesai beberapa detik lebih lama. */
const PARALEL = 2;

const kunci = (t: Target) => `${t.jenisAset}:${t.ticker}`;

/** Semua sinyal di Chart, dijalankan untuk setiap posisi yang dipegang.
 *
 *  Penilaiannya persis sama dengan tampilan Sinyal per ticker (keduanya
 *  lewat evaluasiSinyal), jadi tanda yang lolos di sini pasti lolos juga
 *  saat tickernya dibuka. Pemindai sengaja tidak punya tombol "Jadikan
 *  saran": saran dibuat dari layar yang menunjukkan chart dan levelnya,
 *  bukan dari satu baris tabel. */
export function TampilanPindai({
  posisi, buka,
}: {
  posisi: Target[];
  buka: (ticker: string, jenisAset: JenisAset) => void;
}) {
  const [horizon, setHorizon] = useState<number>(5);
  const [muatan, setMuatan] = useState<Record<string, Muatan>>({});

  // Kunci daftar sebagai string supaya array baru dengan isi yang sama
  // (setiap render portofolio) tidak memicu pemindaian ulang.
  const daftarKunci = posisi.map(kunci).join("|");

  useEffect(() => {
    let batal = false;
    const antrean = daftarKunci ? daftarKunci.split("|") : [];
    const kerja = async () => {
      while (antrean.length && !batal) {
        const k = antrean.shift()!;
        const pisah = k.indexOf(":");
        const jenisAset = k.slice(0, pisah) as JenisAset;
        const ticker = k.slice(pisah + 1);
        setMuatan((m) => ({ ...m, [k]: { status: "memuat" } }));
        const h = await ambilRiwayat(ticker, jenisAset);
        if (batal) return;
        setMuatan((m) => ({
          ...m,
          [k]: h.ok
            ? { status: "siap", batang: h.batang, deteksi: DAFTAR_SINYAL.map((d) => d.deteksi(h.batang)) }
            : { status: "galat", galat: h.galat },
        }));
      }
    };
    Promise.all(Array.from({ length: PARALEL }, kerja));
    return () => { batal = true; };
  }, [daftarKunci]);

  const baris = useMemo(() => posisi.map((t) => {
    const m = muatan[kunci(t)];
    if (!m || m.status !== "siap") return { t, m, ringkas: null };
    return { t, m, ringkas: ringkasPindai(evaluasiSinyal(m.batang, horizon, t.ticker, m.deteksi), true) };
  }), [posisi, muatan, horizon]);

  if (!posisi.length) {
    return (
      <Kartu>
        <Kosong
          ikon={<ScanSearch size={20} />}
          judul="Belum ada posisi untuk dipindai"
          keterangan="Pemindai menjalankan semua pola di setiap posisi yang sedang dipegang."
        />
      </Kartu>
    );
  }

  const selesai = baris.filter((b) => b.ringkas || b.m?.status === "galat").length;
  const layak = baris.filter((b) => b.ringkas?.layak.length);
  const gagal = baris.filter((b) => b.m?.status === "galat").length;

  let ringkasan: string;
  if (selesai < posisi.length) {
    ringkasan = `Memindai ${posisi.length} posisi, ${selesai} selesai.`;
  } else if (layak.length) {
    ringkasan = `Ada yang layak dipertimbangkan di ${layak.map((b) => b.t.ticker).join(", ")}: polanya punya catatan yang bisa dipercaya dan imbalannya minimal ${formatAngka(RR_MIN, 1)} kali risiko. Buka tickernya untuk melihat harga masuk, batas rugi, dan target.`;
  } else {
    ringkasan = `Diam saja hari ini. Di ${posisi.length - gagal} posisi yang kamu pegang, tidak ada pola dalam ${JENDELA_AKTIF} sesi terakhir yang catatannya cukup untuk dipercaya. Rencanamu sendiri untuk tiap posisi tetap yang berlaku.`;
  }
  if (gagal && selesai === posisi.length) {
    ringkasan += ` ${gagal} posisi tidak bisa dipindai karena riwayatnya tidak tersedia.`;
  }

  return (
    <div className="space-y-3">
      <p className="kartu border-l-2 border-l-info px-4 py-3 text-[13px] leading-relaxed text-ink">{ringkasan}</p>

      <Kartu>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-mikro text-[11px] text-ink-soft">
            {DAFTAR_SINYAL.length} pola di {posisi.length} posisi · {JENDELA_AKTIF} sesi terakhir
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
              <Th>Ticker</Th>
              <Th>Tanda yang muncul</Th>
              <Th>Tindakan</Th>
            </>
          }
        >
          {baris.map(({ t, m, ringkas }) => (
            <Tr
              key={kunci(t)}
              className="cursor-pointer align-top"
              onClick={() => buka(t.ticker, t.jenisAset)}
            >
              <Td>
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <ChevronRight size={13} className="text-ink-faint" />
                  {t.ticker}
                </span>
              </Td>
              <Td>
                {!m || m.status === "memuat" ? (
                  <Loader2 size={14} className="animate-spin text-ink-faint" />
                ) : m.status === "galat" ? (
                  <span className="text-peringatan">{m.galat}</span>
                ) : ringkas && ringkas.aktif.length ? (
                  <ul className="space-y-1.5">
                    {ringkas.aktif.map((h) => (
                      <li key={h.def.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1.5 text-ink">
                          <PanahArah arah={h.def.arah} /> {h.def.nama}
                        </span>
                        <LencanaTingkat tingkat={h.nilai.tingkat} searah={h.nilai.searah} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-ink-faint">Tidak ada pola yang muncul.</span>
                )}
              </Td>
              <Td>
                {ringkas ? (
                  <span className={ringkas.layak.length ? "font-medium text-ink" : "text-ink-soft"}>
                    {tindakanPindai(ringkas, t.ticker)}
                  </span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </Td>
            </Tr>
          ))}
        </Tabel>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Setiap pola dinilai di tickernya sendiri, dengan koreksi untuk {DAFTAR_SINYAL.length} uji. Klik baris
          untuk membuka tickernya di tampilan Sinyal.
        </p>
      </Kartu>
    </div>
  );
}
