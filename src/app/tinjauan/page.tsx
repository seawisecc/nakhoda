"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, RefreshCw, Target } from "lucide-react";
import { usePortofolio } from "@/lib/data/portofolio";
import { susunTinjauan, type NadaTemuan } from "@/lib/hitung/tinjauan";
import { bacaAngka, formatPersen, formatUang } from "@/lib/format";
import { formatBulan, hariIni, kunciBulan, selangWaktu } from "@/lib/tanggal";
import { Bidang, IsianAngka, Kartu, JudulKartu, Kosong, Lencana, Tombol } from "@/components/ui/dasar";
import { TombolRiset } from "@/components/tombol-riset";
import { cn } from "@/lib/cn";

const GAYA: Record<NadaTemuan, { kotak: string; ikon: typeof AlertTriangle; warna: string; label: string }> = {
  bahaya:    { kotak: "border-turun/30 bg-turun-lembut",       ikon: AlertTriangle, warna: "text-turun",      label: "perlu diputuskan" },
  perhatian: { kotak: "border-peringatan/30 bg-surface-2",     ikon: Info,          warna: "text-peringatan", label: "perlu dilihat" },
  peluang:   { kotak: "border-naik/30 bg-naik-lembut",         ikon: CheckCircle2,  warna: "text-naik",       label: "kabar baik" },
  netral:    { kotak: "border-bordr bg-surface-2",             ikon: Target,        warna: "text-ink-soft",   label: "konteks" },
};

export default function HalamanTinjauan() {
  const {
    posisi, jurnal, ringkasan, dietz, pengaturan, kurs, siap,
    menyegarkan, segarkanHarga, hargaTertua, transaksi,
  } = usePortofolio();

  const [risiko, setRisiko] = useState("1");

  const temuan = useMemo(
    () =>
      susunTinjauan({
        posisi, jurnal, ringkasan, dietz,
        targetMin: pengaturan.targetBulananMin,
        targetMaks: pengaturan.targetBulananMax,
        risikoPerTrade: bacaAngka(risiko) || 0,
        kurs,
      }),
    [posisi, jurnal, ringkasan, dietz, pengaturan, risiko, kurs],
  );

  const dasar = pengaturan.mataUangDasar;
  const mendesak = temuan.filter((t) => t.nada === "bahaya").length;

  if (!siap) return <div className="rangka h-96" />;

  if (!transaksi.length) {
    return (
      <Kartu>
        <Kosong
          ikon={<ClipboardCheck size={22} />}
          judul="Belum ada yang bisa ditinjau"
          keterangan="Tinjauan dihitung dari posisi dan jurnalmu. Catat transaksi dulu, lalu halaman ini akan terisi sendiri."
          aksi={<Link href="/transaksi?baru=1"><Tombol rupa="utama">Catat transaksi</Tombol></Link>}
        />
      </Kartu>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Kartu>
        <JudulKartu
          judul={`Tinjauan ${formatBulan(kunciBulan(hariIni()))}`}
          keterangan="Dihitung dari transaksi dan jurnalmu sendiri."
          aksi={
            <Tombol ukuran="kecil" onClick={() => void segarkanHarga()} disabled={menyegarkan}>
              <RefreshCw size={13} className={menyegarkan ? "animate-spin" : undefined} />
              Segarkan
            </Tombol>
          }
        />

        {/* Jala hairline, bukan tiga kotak terpisah berjarak. Tiga kotak
            bertepi masing-masing menghasilkan garis dobel di antaranya, dan di
            panel sesempit ini itu yang paling kelihatan. */}
        <div className="jala -mx-4 sm:grid-cols-3">
          <div className="p-3.5">
            <p className="label-mikro">Return bulan ini</p>
            <p className={cn("angka mt-1 text-[20px] font-semibold",
              dietz.persen === null ? "text-ink-faint"
                : dietz.persen >= pengaturan.targetBulananMin ? "text-naik"
                  : dietz.persen >= 0 ? "text-aksen" : "text-turun")}>
              {dietz.persen === null ? "—" : formatPersen(dietz.persen)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              target {formatPersen(pengaturan.targetBulananMin, 0, false)} sampai{" "}
              {formatPersen(pengaturan.targetBulananMax, 0, false)}
            </p>
          </div>

          <div className="p-3.5">
            <p className="label-mikro">Kas siap pakai</p>
            <p className="angka mt-1 text-[20px] font-semibold text-ink">
              {formatUang(ringkasan.kas, dasar, { ringkas: true })}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {ringkasan.totalNilai > 0
                ? `${formatPersen((ringkasan.kas / ringkasan.totalNilai) * 100, 0, false)} dari porto`
                : "—"}
            </p>
          </div>

          <Bidang
            label="Risiko per trade"
            petunjuk="Persen modal yang direlakan hilang kalau stop kena."
            className="p-3.5"
          >
            <IsianAngka value={risiko} onChange={(e) => setRisiko(e.target.value)} className="mt-0" />
          </Bidang>
        </div>

        {hargaTertua ? (
          <p className="mt-4 text-[12px] text-ink-faint">
            Dihitung atas harga yang diambil {selangWaktu(hargaTertua)}.
            {ringkasan.posisiTanpaHarga > 0
              ? ` ${ringkasan.posisiTanpaHarga} posisi belum punya harga, jadi tidak ikut diperiksa stop dan targetnya.`
              : ""}
          </p>
        ) : null}
      </Kartu>

      <Kartu>
        <JudulKartu
          judul="Yang perlu kamu putuskan"
          aksi={
            mendesak > 0
              ? <Lencana nada="turun">{mendesak} mendesak</Lencana>
              : <Lencana nada="naik">tidak ada yang mendesak</Lencana>
          }
        />

        {temuan.length ? (
          <ul className="mt-4 space-y-3">
            {temuan.map((t) => {
              const g = GAYA[t.nada];
              const Ikon = g.ikon;
              return (
                <li key={t.id} className={cn("border p-4", g.kotak)}>
                  <div className="flex items-start gap-3">
                    <Ikon size={17} className={cn("mt-0.5 shrink-0", g.warna)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-medium text-ink">{t.judul}</p>
                        {t.ticker ? (
                          <Link
                            href={`/chart?ticker=${encodeURIComponent(t.ticker)}`}
                            className="text-[12px] text-aksen hover:underline"
                          >
                            lihat chart
                          </Link>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                        {t.penjelasan}
                      </p>
                      {t.nilai !== undefined && t.mataUang ? (
                        <p className="angka mt-2 text-[15px] font-semibold text-ink">
                          {formatUang(t.nilai, t.mataUang)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Kosong
            ikon={<CheckCircle2 size={20} />}
            judul="Tidak ada yang menuntut keputusan hari ini"
            keterangan="Tidak ada stop terlampaui, target tersentuh, atau posisi yang terlalu besar."
          />
        )}
      </Kartu>

      <TombolRiset jatahRisiko={ringkasan.totalNilai * ((bacaAngka(risiko) || 0) / 100)} />

    </div>
  );
}
