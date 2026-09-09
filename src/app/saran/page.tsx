"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CandlestickChart, Check, Sparkles, Trash2, X } from "lucide-react";
import type { Saran } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { rrRencana } from "@/lib/hitung/kinerja";
import { Kartu, Kosong, Lencana, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";
import { FormJurnal } from "@/components/formulir/form-jurnal";
import { PerintahRiset } from "@/components/perintah-riset";
import { TempelSaran } from "@/components/formulir/tempel-saran";
import { cn } from "@/lib/cn";

type Saring = "menunggu" | "diambil" | "diabaikan" | "semua";

const NADA_REKOMENDASI = {
  beli: "naik", jual: "turun", tahan: "netral", pantau: "info",
} as const;

export default function HalamanSaran() {
  const { saran, jurnal, ringkasan, simpan, hapus } = usePortofolio();
  const [saring, setSaring] = useState<Saring>("menunggu");
  const [buatJurnal, setBuatJurnal] = useState<Saran | null>(null);
  const [akanHapus, setAkanHapus] = useState<Saran | null>(null);

  const terlihat = useMemo(
    () =>
      [...saran]
        .filter((s) => (saring === "semua" ? true : s.status === saring))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0)),
    [saran, saring],
  );

  const jumlah = (s: Saran["status"]) => saran.filter((x) => x.status === s).length;

  async function tandai(s: Saran, status: Saran["status"]) {
    await simpan("saran", { ...s, status });
  }

  return (
    <div className="space-y-4">
      <PerintahRiset />

      <Kartu>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["menunggu", `Menunggu (${jumlah("menunggu")})`],
            ["diambil", `Diambil (${jumlah("diambil")})`],
            ["diabaikan", `Diabaikan (${jumlah("diabaikan")})`],
            ["semua", `Semua (${saran.length})`],
          ] as [Saring, string][]).map(([nilai, label]) => (
            <button
              key={nilai}
              onClick={() => setSaring(nilai)}
              className={cn(
                "border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition",
                saring === nilai
                  ? "border-aksen/30 bg-aksen-lembut text-aksen"
                  : "border-bordr text-ink-faint hover:text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto">
            <TempelSaran />
          </div>
        </div>

        <div className="mt-4">
          {terlihat.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {terlihat.map((s) => {
                const rr =
                  s.entrySaran && s.stopSaran && s.targetSaran
                    ? rrRencana({
                        hargaEntry: s.entrySaran,
                        stopLoss: s.stopSaran,
                        targetHarga: s.targetSaran,
                      })
                    : null;
                const jurnalTerkait = s.idJurnal ? jurnal.find((j) => j.id === s.idJurnal) : null;

                return (
                  <li key={s.id} className="flex flex-col border border-bordr bg-surface-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[15px] font-semibold text-ink">{s.ticker}</span>
                        <Lencana nada={NADA_REKOMENDASI[s.rekomendasi]}>{s.rekomendasi}</Lencana>
                        {s.status !== "menunggu" ? (
                          <Lencana nada={s.status === "diambil" ? "info" : "netral"}>{s.status}</Lencana>
                        ) : null}
                      </div>
                      <span className="text-[12px] text-ink-faint">{formatTanggal(s.tanggal)}</span>
                    </div>

                    {s.entrySaran || s.stopSaran || s.targetSaran ? (
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
                        {s.entrySaran ? (
                          <span className="text-ink-faint">
                            Entry <span className="angka text-ink-soft">{formatUang(s.entrySaran, s.mataUang)}</span>
                          </span>
                        ) : null}
                        {s.stopSaran ? (
                          <span className="text-ink-faint">
                            Stop <span className="angka text-turun">{formatUang(s.stopSaran, s.mataUang)}</span>
                          </span>
                        ) : null}
                        {s.targetSaran ? (
                          <span className="text-ink-faint">
                            Target <span className="angka text-naik">{formatUang(s.targetSaran, s.mataUang)}</span>
                          </span>
                        ) : null}
                        {rr !== null ? (
                          <span className="text-ink-faint">
                            R:R <span className="angka text-ink-soft">1 : {rr.toFixed(2).replace(".", ",")}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex-1 space-y-2.5 border-t border-bordr pt-3">
                      {s.catatanTeknikal ? (
                        <div>
                          <p className="label-mikro">Teknikal</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{s.catatanTeknikal}</p>
                        </div>
                      ) : null}
                      {s.catatanFundamental ? (
                        <div>
                          <p className="label-mikro">Fundamental</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{s.catatanFundamental}</p>
                        </div>
                      ) : null}
                    </div>

                    {jurnalTerkait ? (
                      <p className="mt-3 text-[12px] text-ink-faint">
                        Ditautkan ke entri jurnal {formatTanggal(jurnalTerkait.tanggal)}
                        {jurnalTerkait.hasil ? ` · hasil ${jurnalTerkait.hasil}` : ""}.
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-bordr pt-3">
                      {s.status === "menunggu" ? (
                        <>
                          <Tombol rupa="utama" ukuran="kecil" onClick={() => setBuatJurnal(s)}>
                            <Check size={13} />
                            Ambil, buat jurnal
                          </Tombol>
                          <Tombol ukuran="kecil" onClick={() => void tandai(s, "diabaikan")}>
                            <X size={13} />
                            Abaikan
                          </Tombol>
                        </>
                      ) : (
                        <Tombol ukuran="kecil" onClick={() => void tandai(s, "menunggu")}>
                          Kembalikan ke menunggu
                        </Tombol>
                      )}
                      <Link
                        href={`/chart?ticker=${encodeURIComponent(s.ticker)}&jenis=${s.jenisAset}`}
                        className="ml-auto"
                      >
                        <Tombol rupa="hantu" ukuran="kecil">
                          <CandlestickChart size={13} />
                          Chart
                        </Tombol>
                      </Link>
                      <button
                        onClick={() => setAkanHapus(s)}
                        className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                        aria-label={`Hapus saran ${s.ticker}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Kosong
              ikon={<Sparkles size={20} />}
              judul={saran.length ? "Tidak ada saran di kategori ini" : "Belum ada saran masuk"}
              keterangan="Minta riset dari Tinjauan, tempel dari AI lain, atau jalankan perintah terminal di atas."
            />
          )}
        </div>
      </Kartu>

      <FormJurnal
        terbuka={buatJurnal !== null}
        tutup={() => setBuatJurnal(null)}
        dariSaran={buatJurnal}
        modal={ringkasan.totalNilai}
      />

      <Panel
        terbuka={akanHapus !== null}
        tutup={() => setAkanHapus(null)}
        judul="Hapus saran ini?"
        keterangan="Entri jurnal yang sudah tertaut tidak ikut terhapus."
      >
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setAkanHapus(null)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              if (akanHapus) await hapus("saran", akanHapus.id);
              setAkanHapus(null);
            }}
          >
            Hapus
          </Tombol>
        </KakiPanel>
      </Panel>
    </div>
  );
}
