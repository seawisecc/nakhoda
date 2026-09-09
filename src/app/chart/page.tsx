"use client";

import { useMemo, useState } from "react";
import { CandlestickChart, ExternalLink, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { JenisAset } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { useTema } from "@/lib/tema";
import { useParamKueri } from "@/lib/param";
import { formatPersen, formatQty, formatUang, tandaArah } from "@/lib/format";
import { Isian, Kartu, Kosong, Pilihan, warnaArah } from "@/components/ui/dasar";
import { ChartTradingView, simbolTradingView } from "@/components/tradingview";
import { PanelLevel } from "@/components/panel-level";
import { cn } from "@/lib/cn";

export default function HalamanChart() {
  const { posisiAktif, saran, jurnal, kurs } = usePortofolio();
  const { aktif } = useTema();

  const paramTicker = useParamKueri("ticker");
  const paramJenis = useParamKueri("jenis");
  const [pilihan, setPilihan] = useState<{ ticker: string; jenis: JenisAset } | null>(null);
  const [panelTerbuka, setPanelTerbuka] = useState(true);

  const pintasan = useMemo(() => {
    const dariPosisi = posisiAktif.map((p) => ({ ticker: p.ticker, jenisAset: p.jenisAset }));
    const punya = new Set(dariPosisi.map((p) => p.ticker));
    const dariSaran = saran
      .filter((s) => !punya.has(s.ticker))
      .map((s) => ({ ticker: s.ticker, jenisAset: s.jenisAset }));
    const unik = new Map<string, { ticker: string; jenisAset: JenisAset }>();
    for (const x of [...dariPosisi, ...dariSaran]) unik.set(x.ticker, x);
    return [...unik.values()];
  }, [posisiAktif, saran]);

  const bawaan = useMemo<{ ticker: string; jenis: JenisAset }>(() => {
    if (paramTicker) {
      return {
        ticker: paramTicker.toUpperCase(),
        jenis: paramJenis === "kripto" ? "kripto" : "saham",
      };
    }
    if (pintasan.length) return { ticker: pintasan[0].ticker, jenis: pintasan[0].jenisAset };
    return { ticker: "", jenis: "saham" };
  }, [paramTicker, paramJenis, pintasan]);

  const ticker = pilihan?.ticker ?? bawaan.ticker;
  const jenis = pilihan?.jenis ?? bawaan.jenis;
  const simbol = simbolTradingView(ticker, jenis);

  const posisi = posisiAktif.find((p) => p.ticker === ticker.trim().toUpperCase());
  const rencana = jurnal.find((e) => e.ticker === ticker && e.status === "terbuka");
  const mataUang = posisi?.mataUang ?? "USD";

  return (
    <div className="space-y-3">
      {/* Satu baris alat, bukan kartu setinggi separuh layar. Chart yang perlu
          ruang, bukan kolom pemilih ticker. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
          {pintasan.map((p) => {
            const dipilih = ticker === p.ticker;
            return (
              <button
                key={p.ticker}
                onClick={() => setPilihan({ ticker: p.ticker, jenis: p.jenisAset })}
                className={cn(
                  "shrink-0 border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition",
                  dipilih
                    ? "border-aksen/40 bg-aksen-lembut text-aksen"
                    : "border-bordr text-ink-faint hover:border-bordr-strong hover:text-ink-soft",
                )}
              >
                {p.ticker}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Isian
            value={ticker}
            onChange={(e) => setPilihan({ ticker: e.target.value.toUpperCase(), jenis })}
            placeholder="Ticker"
            spellCheck={false}
            aria-label="Ticker"
            className="h-9 w-28 py-1.5"
          />
          <Pilihan
            value={jenis}
            onChange={(e) => setPilihan({ ticker, jenis: e.target.value as JenisAset })}
            aria-label="Jenis aset"
            className="h-9 w-32 py-1.5"
          >
            <option value="saham">Saham AS</option>
            <option value="kripto">Kripto</option>
          </Pilihan>
          {simbol ? (
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(simbol)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="grid size-9 place-items-center border border-bordr text-ink-faint transition hover:text-ink"
              title="Buka di TradingView"
              aria-label="Buka di TradingView"
            >
              <ExternalLink size={15} />
            </a>
          ) : null}
          <button
            onClick={() => setPanelTerbuka((s) => !s)}
            className="hidden size-9 place-items-center border border-bordr text-ink-faint transition hover:text-ink lg:grid"
            title={panelTerbuka ? "Sembunyikan level" : "Tampilkan level"}
            aria-label={panelTerbuka ? "Sembunyikan panel level" : "Tampilkan panel level"}
          >
            {panelTerbuka ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </div>

      {/* Kepemilikan sebagai satu jalur tipis. Informasinya sama, tingginya
          seperlima dari kartu sebelumnya. */}
      {posisi ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border border-bordr bg-surface px-4 py-2.5 text-[13px]">
          <span className="font-semibold text-ink">{posisi.ticker}</span>
          <Angka label="Jumlah" nilai={formatQty(posisi.qty)} />
          <Angka label="Rata-rata" nilai={formatUang(posisi.avgHarga, mataUang)} />
          {posisi.hargaTerakhir !== undefined ? (
            <Angka label="Kini" nilai={formatUang(posisi.hargaTerakhir, mataUang)} />
          ) : null}
          <Angka label="Nilai" nilai={formatUang(posisi.nilaiPasar ?? posisi.biayaTotal, mataUang)} />
          {posisi.labaBelumTerealisasiPersen !== undefined ? (
            <span className="flex items-baseline gap-1.5">
              <span className="label-mikro">P&L</span>
              <span className={cn("angka font-medium", warnaArah(posisi.labaBelumTerealisasi ?? null))}>
                <span aria-hidden>{tandaArah(posisi.labaBelumTerealisasi ?? 0)}</span>{" "}
                {formatPersen(Math.abs(posisi.labaBelumTerealisasiPersen), 2, false)}
              </span>
            </span>
          ) : null}
          {rencana ? (
            <span className="ml-auto flex items-center gap-4 text-[12px]">
              <span className="text-ink-faint">
                Stop <span className="angka text-turun">{formatUang(rencana.stopLoss, rencana.mataUang)}</span>
              </span>
              <span className="text-ink-faint">
                Target <span className="angka text-naik">{formatUang(rencana.targetHarga, rencana.mataUang)}</span>
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {simbol ? (
        <div
          className={cn(
            "grid gap-3",
            panelTerbuka ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "lg:grid-cols-1",
          )}
        >
          {/* Tinggi dikunci ke tinggi layar, bukan angka tetap. Chart adalah
              alasan halaman ini ada, jadi dia yang mendapat sisa ruangnya. */}
          <div className="h-[min(78vh,900px)] min-h-[420px]">
            <ChartTradingView simbol={simbol} tema={aktif} tinggi="100%" />
          </div>
          {panelTerbuka ? (
            <div className="h-[min(78vh,900px)] min-h-[360px]">
              <PanelLevel
                key={`${ticker}-${jenis}`}
                ticker={ticker}
                jenisAset={jenis}
                mataUang={mataUang}
                kurs={kurs}
                milikmu={{
                  avgHarga: posisi?.avgHarga,
                  stopLoss: rencana?.stopLoss,
                  targetHarga: rencana?.targetHarga,
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <Kartu>
          <Kosong
            ikon={<CandlestickChart size={20} />}
            judul="Pilih ticker untuk melihat chart"
            keterangan="Chart dan indikatornya dari TradingView."
          />
        </Kartu>
      )}
    </div>
  );
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="label-mikro">{label}</span>
      <span className="angka text-ink-soft">{nilai}</span>
    </span>
  );
}
