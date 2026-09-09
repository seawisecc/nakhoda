"use client";

import { useState } from "react";
import type {
  HasilJurnal, JenisAset, JurnalEntri, MataUang, Saran, StatusJurnal,
} from "@/types";
import { useData, buatId } from "@/lib/data/penyedia";
import { rMultiple } from "@/lib/hitung/kinerja";
import { bacaAngka, formatAngka } from "@/lib/format";
import { hariIni } from "@/lib/tanggal";
import { AreaTeks, Bidang, Isian, IsianAngka, Lencana, Pilihan, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";
import { HasilRisiko } from "./kalkulator-risiko";

interface Isi {
  tanggal: string;
  ticker: string;
  jenisAset: JenisAset;
  mataUang: MataUang;
  entry: string;
  stop: string;
  target: string;
  qty: string;
  thesisTeknikal: string;
  thesisFundamental: string;
  status: StatusJurnal;
  hasil: HasilJurnal | "";
  hargaKeluar: string;
  tanggalKeluar: string;
  pelajaran: string;
}

function isiAwal(e?: JurnalEntri | null, dariSaran?: Saran | null): Isi {
  return {
    tanggal: e?.tanggal ?? dariSaran?.tanggal ?? hariIni(),
    ticker: e?.ticker ?? dariSaran?.ticker ?? "",
    jenisAset: e?.jenisAset ?? dariSaran?.jenisAset ?? "saham",
    mataUang: e?.mataUang ?? dariSaran?.mataUang ?? "USD",
    entry: e ? String(e.hargaEntry) : dariSaran?.entrySaran ? String(dariSaran.entrySaran) : "",
    stop: e ? String(e.stopLoss) : dariSaran?.stopSaran ? String(dariSaran.stopSaran) : "",
    target: e ? String(e.targetHarga) : dariSaran?.targetSaran ? String(dariSaran.targetSaran) : "",
    qty: e?.qty ? String(e.qty) : "",
    thesisTeknikal: e?.thesisTeknikal ?? dariSaran?.catatanTeknikal ?? "",
    thesisFundamental: e?.thesisFundamental ?? dariSaran?.catatanFundamental ?? "",
    status: e?.status ?? "terbuka",
    hasil: e?.hasil ?? "",
    hargaKeluar: e?.hargaKeluar !== undefined ? String(e.hargaKeluar) : "",
    tanggalKeluar: e?.tanggalKeluar ?? "",
    pelajaran: e?.pelajaran ?? "",
  };
}

/** Isinya dipisah supaya keadaan awal formulir lahir dari useState saat panel
 *  dibuka, bukan dari efek yang menyetel ulang state setelah render pertama. */
export function FormJurnal({
  terbuka, tutup, sunting, dariSaran, modal,
}: {
  terbuka: boolean;
  tutup: () => void;
  sunting?: JurnalEntri | null;
  dariSaran?: Saran | null;
  /** Modal yang dipakai kalkulator ukuran posisi, dalam mata uang entri. */
  modal: number;
}) {
  return (
    <Panel
      terbuka={terbuka}
      tutup={tutup}
      judul={sunting ? "Ubah entri jurnal" : "Entri jurnal baru"}
      keterangan="Tulis alasannya sekarang, saat masih terasa jelas. Nanti setelah posisi ditutup, alasan inilah yang bisa dinilai, bukan ingatan."
      lebar="lebar"
    >
      <IsiFormJurnal
        key={sunting?.id ?? dariSaran?.id ?? "baru"}
        tutup={tutup}
        sunting={sunting}
        dariSaran={dariSaran}
        modal={modal}
      />
    </Panel>
  );
}

function IsiFormJurnal({
  tutup, sunting, dariSaran, modal,
}: {
  tutup: () => void;
  sunting?: JurnalEntri | null;
  dariSaran?: Saran | null;
  modal: number;
}) {
  const { simpan, pengguna } = useData();
  const [isi, setIsi] = useState<Isi>(() => isiAwal(sunting, dariSaran));
  const [risiko, setRisiko] = useState("1");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);

  const ubah = <K extends keyof Isi>(k: K, v: Isi[K]) => setIsi((s) => ({ ...s, [k]: v }));

  const entry = bacaAngka(isi.entry);
  const stop = bacaAngka(isi.stop);
  const target = bacaAngka(isi.target);
  const keluar = bacaAngka(isi.hargaKeluar);

  const rSaatIni =
    isi.status === "tertutup" && Number.isFinite(keluar)
      ? rMultiple({
          hargaEntry: entry, stopLoss: stop, targetHarga: target, hargaKeluar: keluar,
        } as JurnalEntri)
      : null;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const g: Record<string, string> = {};
    if (!isi.ticker.trim()) g.ticker = "Ticker wajib diisi.";
    if (!Number.isFinite(entry) || entry <= 0) g.entry = "Harga entry wajib diisi.";
    if (!Number.isFinite(stop) || stop <= 0) g.stop = "Stop loss wajib diisi.";
    if (!Number.isFinite(target) || target <= 0) g.target = "Target wajib diisi.";
    if (Number.isFinite(entry) && Number.isFinite(stop) && entry === stop) {
      g.stop = "Stop tidak boleh sama dengan entry.";
    }
    if (isi.status === "tertutup") {
      if (!Number.isFinite(keluar) || keluar <= 0) g.hargaKeluar = "Isi harga keluar untuk trade yang ditutup.";
      if (!isi.hasil) g.hasil = "Pilih hasilnya.";
    }
    setGalat(g);
    if (Object.keys(g).length) return;

    setSibuk(true);
    try {
      const qty = bacaAngka(isi.qty);
      const dok: JurnalEntri = {
        id: sunting?.id ?? buatId(),
        uid: pengguna?.uid ?? "lokal",
        ticker: isi.ticker.trim().toUpperCase(),
        jenisAset: isi.jenisAset,
        tanggal: isi.tanggal,
        mataUang: isi.mataUang,
        thesisTeknikal: isi.thesisTeknikal.trim(),
        thesisFundamental: isi.thesisFundamental.trim(),
        hargaEntry: entry,
        stopLoss: stop,
        targetHarga: target,
        status: isi.status,
        dibuatPada: sunting?.dibuatPada ?? Date.now(),
      };
      if (Number.isFinite(qty) && qty > 0) dok.qty = qty;
      if (isi.status === "tertutup") {
        dok.hasil = isi.hasil as HasilJurnal;
        dok.hargaKeluar = keluar;
        if (isi.tanggalKeluar) dok.tanggalKeluar = isi.tanggalKeluar;
      }
      if (isi.pelajaran.trim()) dok.pelajaran = isi.pelajaran.trim();
      const idSaran = sunting?.idSaran ?? dariSaran?.id;
      if (idSaran) dok.idSaran = idSaran;

      await simpan("jurnal", dok);

      // Saran yang jadi entri jurnal otomatis ditandai sudah ditindaklanjuti,
      // dan ditautkan balik. Tanpa tautan dua arah ini, perbandingan
      // "saran AI vs keputusan sendiri" di dasbor tidak akan pernah terisi.
      if (dariSaran && !sunting) {
        await simpan("saran", { ...dariSaran, status: "diambil", idJurnal: dok.id });
      }
      tutup();
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
        {dariSaran && !sunting ? (
          <div className="flex items-center gap-2 border border-aksen/25 bg-aksen-lembut px-3.5 py-2.5">
            <Lencana nada="info">dari saran AI</Lencana>
            <span className="text-[12px] text-ink-soft">
              Entri ini akan ditautkan ke saran {dariSaran.ticker} tanggal {dariSaran.tanggal}.
            </span>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <Bidang label="Tanggal" wajib>
            <Isian type="date" value={isi.tanggal} onChange={(e) => ubah("tanggal", e.target.value)} />
          </Bidang>
          <Bidang label="Ticker" wajib galat={galat.ticker}>
            <Isian
              value={isi.ticker}
              onChange={(e) => ubah("ticker", e.target.value.toUpperCase())}
              placeholder="NVDA"
              spellCheck={false}
            />
          </Bidang>
          <Bidang label="Jenis aset">
            <Pilihan value={isi.jenisAset} onChange={(e) => ubah("jenisAset", e.target.value as JenisAset)}>
              <option value="saham">Saham AS</option>
              <option value="kripto">Kripto</option>
            </Pilihan>
          </Bidang>
          <Bidang label="Mata uang">
            <Pilihan value={isi.mataUang} onChange={(e) => ubah("mataUang", e.target.value as MataUang)}>
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </Pilihan>
          </Bidang>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Bidang label="Harga entry" wajib galat={galat.entry}>
            <IsianAngka value={isi.entry} onChange={(e) => ubah("entry", e.target.value)} />
          </Bidang>
          <Bidang label="Stop loss" wajib galat={galat.stop}>
            <IsianAngka value={isi.stop} onChange={(e) => ubah("stop", e.target.value)} />
          </Bidang>
          <Bidang label="Target" wajib galat={galat.target}>
            <IsianAngka value={isi.target} onChange={(e) => ubah("target", e.target.value)} />
          </Bidang>
          <Bidang label="Risiko" petunjuk="Persen dari modal.">
            <IsianAngka value={risiko} onChange={(e) => setRisiko(e.target.value)} />
          </Bidang>
        </div>

        <HasilRisiko
          harga={{ entry: isi.entry, stop: isi.stop, target: isi.target }}
          modal={modal}
          risikoPersen={bacaAngka(risiko) || 0}
          mataUang={isi.mataUang}
          ringkas
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Bidang label="Thesis teknikal" petunjuk="Setup, level, indikator yang dipakai.">
            <AreaTeks
              value={isi.thesisTeknikal}
              onChange={(e) => ubah("thesisTeknikal", e.target.value)}
              placeholder="Breakout dari konsolidasi tiga minggu, RSI 58, volume naik di hari breakout."
            />
          </Bidang>
          <Bidang label="Thesis fundamental" petunjuk="Alasan bisnis atau valuasinya.">
            <AreaTeks
              value={isi.thesisFundamental}
              onChange={(e) => ubah("thesisFundamental", e.target.value)}
              placeholder="Guidance dinaikkan, margin data center melebar, valuasi masih di bawah rata-rata lima tahun."
            />
          </Bidang>
        </div>

        <div className="border border-bordr p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Bidang label="Status">
              <Pilihan value={isi.status} onChange={(e) => ubah("status", e.target.value as StatusJurnal)}>
                <option value="terbuka">Masih terbuka</option>
                <option value="tertutup">Sudah ditutup</option>
                <option value="batal">Batal, tidak jadi masuk</option>
              </Pilihan>
            </Bidang>

            {isi.status === "tertutup" ? (
              <>
                <Bidang label="Harga keluar" wajib galat={galat.hargaKeluar}>
                  <IsianAngka
                    value={isi.hargaKeluar}
                    onChange={(e) => ubah("hargaKeluar", e.target.value)}
                  />
                </Bidang>
                <Bidang label="Hasil" wajib galat={galat.hasil}>
                  <Pilihan
                    value={isi.hasil}
                    onChange={(e) => ubah("hasil", e.target.value as HasilJurnal | "")}
                  >
                    <option value="">Pilih</option>
                    <option value="untung">Untung</option>
                    <option value="rugi">Rugi</option>
                    <option value="impas">Impas</option>
                  </Pilihan>
                </Bidang>
              </>
            ) : null}
          </div>

          {isi.status === "tertutup" ? (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Bidang label="Tanggal keluar">
                  <Isian
                    type="date"
                    value={isi.tanggalKeluar}
                    onChange={(e) => ubah("tanggalKeluar", e.target.value)}
                  />
                </Bidang>
                {rSaatIni !== null ? (
                  <div className="flex items-end pb-1">
                    <div>
                      <p className="label-mikro">
                        Hasil dalam kelipatan risiko
                      </p>
                      <p
                        className={`angka mt-1 text-[20px] font-semibold ${
                          rSaatIni > 0 ? "text-naik" : rSaatIni < 0 ? "text-turun" : "text-ink-soft"
                        }`}
                      >
                        {rSaatIni > 0 ? "+" : ""}
                        {formatAngka(rSaatIni, 2)}R
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <Bidang
                label="Pelajaran"
                className="mt-3"
                petunjuk="Yang benar-benar berguna: apa yang kamu lakukan berbeda lain kali."
              >
                <AreaTeks
                  value={isi.pelajaran}
                  onChange={(e) => ubah("pelajaran", e.target.value)}
                  rows={2}
                  className="min-h-16"
                />
              </Bidang>
            </>
          ) : null}
        </div>

        <KakiPanel>
          <Tombol type="button" rupa="hantu" onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" rupa="utama" disabled={sibuk}>
            {sibuk ? "Menyimpan" : "Simpan entri"}
          </Tombol>
      </KakiPanel>
    </form>
  );
}
