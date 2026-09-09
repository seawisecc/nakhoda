"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import type { MataUang } from "@/types";
import { hitungRisiko, nilaiRR } from "@/lib/hitung/risiko";
import { bacaAngka, formatPersen, formatQty, formatUang } from "@/lib/format";
import { konversi, type Kurs } from "@/lib/hitung/uang";
import { Bidang, IsianAngka, Lencana, Pilihan } from "@/components/ui/dasar";
import { Baris } from "@/components/ui/statistik";
import { cn } from "@/lib/cn";

export interface NilaiHarga {
  entry: string;
  stop: string;
  target: string;
}

/** Blok hasil kalkulator.
 *
 *  Dipakai dua tempat: kalkulator berdiri sendiri, dan di dalam formulir
 *  jurnal supaya angka R:R muncul sambil mengetik, bukan setelah menyimpan. */
export function HasilRisiko({
  harga, modal, risikoPersen, mataUang, ringkas = false,
}: {
  harga: NilaiHarga;
  modal: number;
  risikoPersen: number;
  mataUang: MataUang;
  ringkas?: boolean;
}) {
  const hasil = useMemo(
    () =>
      hitungRisiko({
        entry: bacaAngka(harga.entry),
        stop: bacaAngka(harga.stop),
        target: bacaAngka(harga.target),
        modal,
        risikoPersen,
      }),
    [harga.entry, harga.stop, harga.target, modal, risikoPersen],
  );

  if (!hasil.valid) {
    return (
      <div className="border border-dashed border-bordr px-3.5 py-4 text-[13px] leading-relaxed text-ink-faint">
        {hasil.pesan ?? "Isi harga entry, stop loss, dan target untuk melihat hitungannya."}
      </div>
    );
  }

  const penilaian = nilaiRR(hasil.rasioRR);

  return (
    <div className="border border-bordr bg-surface-sunk p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mikro">Rasio imbal-risiko</p>
          <p className="angka mt-1 text-[26px] leading-none font-semibold text-ink">
            1 : {hasil.rasioRR.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Lencana
            nada={penilaian.nada === "baik" ? "naik" : penilaian.nada === "cukup" ? "peringatan" : "turun"}
          >
            {penilaian.label}
          </Lencana>
          <Lencana nada={hasil.arah === "long" ? "info" : "peringatan"}>{hasil.arah}</Lencana>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
        Dengan rasio ini kamu cukup benar{" "}
        <span className="angka font-medium text-ink-soft">
          {formatPersen(hasil.winRateImpas, 0, false)}
        </span>{" "}
        dari waktu untuk sekadar impas. Di atas itu, kamu untung.
      </p>

      {!ringkas ? (
        <div className="mt-4 divide-y divide-bordr border-t border-bordr">
          <Baris
            label="Ukuran posisi"
            nilai={`${formatQty(hasil.ukuranPosisi)} unit`}
            petunjuk="Lahir dari jatah risiko, bukan dari besarnya modal."
          />
          <Baris label="Nilai posisi" nilai={formatUang(hasil.nilaiPosisi, mataUang)} />
          <Baris
            label="Porsi dari modal"
            nilai={formatPersen(hasil.porsiModalPersen, 1, false)}
          />
          <Baris
            label="Rugi kalau stop kena"
            nilai={
              <span className="text-turun">-{formatUang(hasil.potensiRugi, mataUang)}</span>
            }
          />
          <Baris
            label="Untung kalau target kena"
            nilai={
              <span className="text-naik">+{formatUang(hasil.potensiUntung, mataUang)}</span>
            }
          />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-4 border-t border-bordr pt-3 text-[12px]">
          <span className="text-ink-faint">
            Rugi <span className="angka text-turun">-{formatUang(hasil.potensiRugi, mataUang)}</span>
          </span>
          <span className="text-ink-faint">
            Untung <span className="angka text-naik">+{formatUang(hasil.potensiUntung, mataUang)}</span>
          </span>
          <span className="ml-auto text-ink-faint">
            <span className="angka">{formatQty(hasil.ukuranPosisi)}</span> unit
          </span>
        </div>
      )}
    </div>
  );
}

/** Kalkulator berdiri sendiri.
 *
 *  Satu hal yang harus dijaga di sini: harga entry dan modal wajib berada di
 *  mata uang yang sama. Modal terisi otomatis dari nilai portofolio dalam
 *  rupiah, sementara harga saham AS hampir selalu diketik dalam dolar. Kalau
 *  mata uang diganti tanpa modalnya ikut dikonversi, ukuran posisi meleset
 *  ribuan kali lipat, dan kelirunya tidak kelihatan mencurigakan: angkanya
 *  cuma terlihat besar. Karena itu mengganti mata uang ikut mengonversi
 *  modalnya. */
export function KalkulatorRisiko({
  modalAwal, mataUangAwal = "USD", kurs, className,
}: {
  modalAwal: number;
  mataUangAwal?: MataUang;
  kurs: Kurs;
  className?: string;
}) {
  const [harga, setHarga] = useState<NilaiHarga>({ entry: "", stop: "", target: "" });
  const [modal, setModal] = useState(String(Math.round(modalAwal)));
  const [risiko, setRisiko] = useState("1");
  const [mataUang, setMataUang] = useState<MataUang>(mataUangAwal);

  function gantiMataUang(baru: MataUang) {
    const nilai = bacaAngka(modal);
    if (Number.isFinite(nilai)) {
      const dikonversi = konversi(nilai, mataUang, baru, kurs);
      setModal(String(baru === "IDR" ? Math.round(dikonversi) : Number(dikonversi.toFixed(2))));
    }
    setMataUang(baru);
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-ink-soft">
        <Calculator size={15} />
        <span className="text-[13px] font-medium">Kalkulator ukuran posisi</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Bidang label="Entry">
          <IsianAngka
            value={harga.entry}
            onChange={(e) => setHarga((s) => ({ ...s, entry: e.target.value }))}
            placeholder="100"
          />
        </Bidang>
        <Bidang label="Stop loss">
          <IsianAngka
            value={harga.stop}
            onChange={(e) => setHarga((s) => ({ ...s, stop: e.target.value }))}
            placeholder="90"
          />
        </Bidang>
        <Bidang label="Target">
          <IsianAngka
            value={harga.target}
            onChange={(e) => setHarga((s) => ({ ...s, target: e.target.value }))}
            placeholder="130"
          />
        </Bidang>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Bidang label="Modal" className="col-span-1">
          <IsianAngka value={modal} onChange={(e) => setModal(e.target.value)} />
        </Bidang>
        <Bidang label="Risiko per trade" petunjuk="Persen dari modal.">
          <IsianAngka value={risiko} onChange={(e) => setRisiko(e.target.value)} />
        </Bidang>
        <Bidang label="Mata uang" petunjuk="Harga dan modal harus satu mata uang.">
          <Pilihan value={mataUang} onChange={(e) => gantiMataUang(e.target.value as MataUang)}>
            <option value="USD">USD</option>
            <option value="IDR">IDR</option>
          </Pilihan>
        </Bidang>
      </div>

      <HasilRisiko
        harga={harga}
        modal={bacaAngka(modal) || 0}
        risikoPersen={bacaAngka(risiko) || 0}
        mataUang={mataUang}
      />
    </div>
  );
}
