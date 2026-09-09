"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import type { JenisAset, MataUang } from "@/types";
import {
  konversiOhlc, levelTerdekat, posisiDalamRentang, susunLevel,
  type Level, type LevelMilikmu, type Ohlc,
} from "@/lib/hitung/level";
import { type Kurs } from "@/lib/hitung/uang";
import { formatPersen, formatUang } from "@/lib/format";
import { cn } from "@/lib/cn";

const WARNA: Record<Level["kelompok"], string> = {
  milikmu: "bg-aksen",
  pivot: "bg-[var(--nk-seri-2)]",
  fibonacci: "bg-[var(--nk-seri-3)]",
};

/** Level harga di sekitar harga sekarang.
 *
 *  Semuanya aritmatika atas OHLC sesi terakhir: pivot klasik, retracement
 *  Fibonacci, dan level milikmu sendiri dari posisi dan jurnal. Tidak ada yang
 *  meramal arah; yang dikerjakan cuma menandai angka-angka yang lazim
 *  diperhatikan orang, supaya tidak perlu dihitung di kepala sambil menatap
 *  chart. */
export function PanelLevel({
  ticker, jenisAset, mataUang, milikmu, kurs,
}: {
  ticker: string;
  jenisAset: JenisAset;
  /** Mata uang posisi. Level milikmu sudah dalam mata uang ini. */
  mataUang: MataUang;
  milikmu: LevelMilikmu;
  kurs: Kurs;
}) {
  /* Panel ini di-remount oleh induknya setiap kali ticker berubah (lewat
     prop key), jadi keadaan awal cukup ditulis di useState. Menyetelnya ulang
     di dalam efek akan memicu satu putaran render tambahan tiap pergantian
     ticker, dan panelnya sempat menampilkan level ticker sebelumnya. */
  const [ohlc, setOhlc] = useState<Ohlc | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState<"semua" | "pivot" | "fibonacci">("semua");

  useEffect(() => {
    if (!ticker) return;
    let batal = false;
    fetch(`/api/ohlc?ticker=${encodeURIComponent(ticker)}&jenis=${jenisAset}`)
      .then(async (r) => {
        const j = await r.json();
        if (batal) return;
        if (!r.ok) {
          setOhlc(null);
          setGalat(j.galat ?? "OHLC tidak tersedia.");
          return;
        }
        // Route OHLC selalu membalas dalam USD; level milikmu dalam mata uang
        // posisi. Konversinya diuji di src/lib/hitung/level.ts.
        setOhlc(
          konversiOhlc(
            {
              buka: j.buka, tinggi: j.tinggi, rendah: j.rendah,
              tutup: j.tutup, tutupSebelumnya: j.tutupSebelumnya,
            },
            mataUang,
            kurs,
          ),
        );
      })
      .catch(() => {
        if (!batal) setGalat("Gagal mengambil data sesi.");
      })
      .finally(() => {
        if (!batal) setMemuat(false);
      });
    return () => { batal = true; };
  }, [ticker, jenisAset, mataUang, kurs]);

  const hargaKini = ohlc?.tutup ?? milikmu.avgHarga ?? 0;
  const semua = susunLevel(ohlc, hargaKini, milikmu);
  const terlihat = semua.filter(
    (l) => saring === "semua" || l.kelompok === saring || l.kelompok === "milikmu",
  );
  const { atas, bawah } = levelTerdekat(semua, hargaKini);
  const posisi = ohlc ? posisiDalamRentang(ohlc, hargaKini) : null;

  return (
    <div className="kartu flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-mikro text-[11px] text-ink-soft">
          Level harga
        </h2>
        {memuat ? <Loader2 size={14} className="animate-spin text-ink-faint" /> : null}
      </div>

      {ohlc ? (
        <>
          {/* Rentang sesi. Menjawab satu pertanyaan sekali lihat: harga
              sekarang dekat puncak hari ini atau dekat dasarnya. */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[11px] text-ink-faint">
              <span className="angka">{formatUang(ohlc.rendah, mataUang)}</span>
              <span className="label-mikro">rentang sesi</span>
              <span className="angka">{formatUang(ohlc.tinggi, mataUang)}</span>
            </div>
            <div className="relative mt-1.5 h-1.5 bg-surface-sunk">
              {posisi !== null ? (
                <span
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 bg-aksen ring-2 ring-[var(--nk-surface)]"
                  style={{ left: `${posisi * 100}%` }}
                  aria-hidden
                />
              ) : null}
            </div>
          </div>

          <div className="jala -mx-4 mt-4 grid-cols-2">
            {([
              ["Terdekat di atas", atas, ArrowUp, "text-naik"],
              ["Terdekat di bawah", bawah, ArrowDown, "text-turun"],
            ] as const).map(([label, l, Ikon, warna]) => (
              <div key={label} className="p-2.5">
                <p className="label-mikro flex items-center gap-1">
                  <Ikon size={11} className={warna} />
                  {label}
                </p>
                {l ? (
                  <>
                    <p className="angka mt-1 text-[14px] font-semibold text-ink">
                      {formatUang(l.harga, mataUang)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                      {l.nama} · {formatPersen(l.jarakPersen, 1)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-faint">—</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : galat ? (
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">{galat}</p>
      ) : null}

      <div className="mt-4 flex gap-1">
        {([
          ["semua", "Semua"],
          ["pivot", "Pivot"],
          ["fibonacci", "Fibonacci"],
        ] as const).map(([n, label]) => (
          <button
            key={n}
            onClick={() => setSaring(n)}
            className={cn(
              "border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] uppercase transition",
              saring === n
                ? "border-aksen/40 bg-aksen-lembut text-aksen"
                : "border-bordr text-ink-faint hover:text-ink-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-3 min-h-0 flex-1 space-y-px overflow-y-auto pr-1">
        {terlihat.map((l) => {
          const diAtas = l.harga > hargaKini;
          return (
            <li
              key={`${l.kelompok}-${l.nama}`}
              className="flex items-center gap-2 px-1.5 py-1.5 transition-colors hover:bg-surface-2"
            >
              <span className={cn("size-1.5 shrink-0", WARNA[l.kelompok])} aria-hidden />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[12px]",
                  l.kelompok === "milikmu" ? "font-medium text-aksen" : "text-ink-faint",
                )}
              >
                {l.nama}
              </span>
              <span className="angka text-[12px] text-ink">{formatUang(l.harga, mataUang)}</span>
              <span
                className={cn(
                  "angka w-14 shrink-0 text-right text-[11px]",
                  diAtas ? "text-naik" : "text-turun",
                )}
              >
                {formatPersen(l.jarakPersen, 1)}
              </span>
            </li>
          );
        })}
        {!terlihat.length && !memuat ? (
          <li className="py-6 text-center text-[12px] text-ink-faint">
            Belum ada level yang bisa dihitung.
          </li>
        ) : null}
      </ul>

      <p className="mt-3 border-t border-bordr pt-2.5 text-[11px] leading-relaxed text-ink-faint">
        Pivot dan Fibonacci dihitung dari OHLC sesi terakhir. Angka yang lazim diperhatikan,
        bukan ramalan arah.
      </p>
    </div>
  );
}
