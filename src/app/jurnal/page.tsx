"use client";

import { useMemo, useState } from "react";
import { Calculator, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import type { JurnalEntri } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { bandingkanSumber, rMultiple, rrRencana } from "@/lib/hitung/kinerja";
import { formatAngka, formatPersen, formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { bersihkanParam, useParamKueri } from "@/lib/param";
import { Kartu, JudulKartu, Kosong, Lencana, Pilihan, Tombol } from "@/components/ui/dasar";
import { JalaUbin, Ubin, Baris } from "@/components/ui/statistik";
import { KakiPanel, Panel } from "@/components/ui/panel";
import { FormJurnal } from "@/components/formulir/form-jurnal";
import { KalkulatorRisiko } from "@/components/formulir/kalkulator-risiko";
import { cn } from "@/lib/cn";

type Saring = "semua" | "terbuka" | "tertutup" | "untung" | "rugi";

export default function HalamanJurnal() {
  const { jurnal, statistik, ringkasan, pengaturan, kurs, hapus } = usePortofolio();
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [kalkulatorTerbuka, setKalkulatorTerbuka] = useState(false);
  const [sunting, setSunting] = useState<JurnalEntri | null>(null);
  const [akanHapus, setAkanHapus] = useState<JurnalEntri | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const [cariTicker, setCariTicker] = useState("semua");

  // Hook dipanggil lebih dulu tanpa syarat. Menulisnya sebagai
  // `formTerbuka || useParamKueri(...)` akan melewati pemanggilan hook begitu
  // ruas kiri bernilai benar, dan urutan hook jadi berubah antar render.
  const bukaDariUrl = useParamKueri("baru") === "1";
  const kalkulatorDariUrl = useParamKueri("kalkulator") === "1";
  const formulirTerbuka = formTerbuka || bukaDariUrl;
  const kalkulatorAktif = kalkulatorTerbuka || kalkulatorDariUrl;

  function tutupFormulir() {
    setFormTerbuka(false);
    setSunting(null);
    bersihkanParam("baru");
  }
  function tutupKalkulator() {
    setKalkulatorTerbuka(false);
    bersihkanParam("kalkulator");
  }

  const perbandingan = useMemo(() => bandingkanSumber(jurnal), [jurnal]);
  const semuaTicker = useMemo(
    () => [...new Set(jurnal.map((e) => e.ticker))].sort(),
    [jurnal],
  );

  const terlihat = useMemo(
    () =>
      [...jurnal]
        .filter((e) => (cariTicker === "semua" ? true : e.ticker === cariTicker))
        .filter((e) => {
          if (saring === "semua") return true;
          if (saring === "terbuka") return e.status === "terbuka";
          if (saring === "tertutup") return e.status === "tertutup";
          return e.hasil === saring;
        })
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0)),
    [jurnal, saring, cariTicker],
  );

  return (
    <div className="space-y-4">
      <JalaUbin>
        <Ubin
          label="Win rate"
          nilai={statistik.winRate === null ? "—" : formatPersen(statistik.winRate, 1, false)}
          sub={`${statistik.menang} dari ${statistik.totalTertutup} ditutup`}
        />
        <Ubin
          label="Ekspektansi"
          nilai={
            statistik.ekspektansiR === null ? "—" : (
              <span className={statistik.ekspektansiR >= 0 ? "text-naik" : "text-turun"}>
                {statistik.ekspektansiR > 0 ? "+" : ""}
                {formatAngka(statistik.ekspektansiR, 2)}R
              </span>
            )
          }
          sub="rata-rata hasil per trade"
        />
        <Ubin
          label="Rata-rata menang"
          nilai={statistik.rataMenangR === null ? "—" : `+${formatAngka(statistik.rataMenangR, 2)}R`}
        />
        <Ubin label="Masih terbuka" nilai={statistik.terbuka} sub="posisi berjalan" />
      </JalaUbin>

      {statistik.totalTertutup > 0 && perbandingan.dariSaran.totalTertutup > 0 ? (
        <Kartu>
          <JudulKartu
            judul="Saran AI dibanding keputusan sendiri"
            keterangan="Alasan koleksi saran ada: supaya bisa dinilai, bukan dituruti buta-buta."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {([
              ["Dari saran AI", perbandingan.dariSaran],
              ["Keputusan sendiri", perbandingan.sendiri],
            ] as const).map(([label, s]) => (
              <div key={label} className="border border-bordr bg-surface-sunk p-4">
                <p className="text-[13px] font-medium text-ink">{label}</p>
                <Baris
                  label="Win rate"
                  nilai={s.winRate === null ? "—" : formatPersen(s.winRate, 1, false)}
                />
                <Baris
                  label="Ekspektansi"
                  nilai={s.ekspektansiR === null ? "—" : `${formatAngka(s.ekspektansiR, 2)}R`}
                />
                <Baris label="Trade ditutup" nilai={s.totalTertutup} />
              </div>
            ))}
          </div>
        </Kartu>
      ) : null}

      <Kartu>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["semua", "Semua"],
              ["terbuka", "Terbuka"],
              ["tertutup", "Ditutup"],
              ["untung", "Menang"],
              ["rugi", "Kalah"],
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
          </div>

          {semuaTicker.length > 1 ? (
            <Pilihan
              value={cariTicker}
              onChange={(e) => setCariTicker(e.target.value)}
              className="w-auto min-w-32 py-1 text-[12px]"
              aria-label="Saring ticker"
            >
              <option value="semua">Semua ticker</option>
              {semuaTicker.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Pilihan>
          ) : null}

          <div className="ml-auto flex gap-2">
            <Tombol onClick={() => setKalkulatorTerbuka(true)}>
              <Calculator size={15} />
              Kalkulator
            </Tombol>
            <Tombol
              rupa="utama"
              onClick={() => {
                setSunting(null);
                setFormTerbuka(true);
              }}
            >
              <Plus size={15} />
              Entri baru
            </Tombol>
          </div>
        </div>

        <div className="mt-4">
          {terlihat.length ? (
            <ul className="space-y-3">
              {terlihat.map((e) => {
                const rr = rrRencana(e);
                const r = rMultiple(e);
                return (
                  <li key={e.id} className="border border-bordr bg-surface-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[15px] font-semibold text-ink">{e.ticker}</span>
                        <Lencana
                          nada={
                            e.status === "terbuka" ? "info"
                              : e.status === "batal" ? "netral"
                                : e.hasil === "untung" ? "naik"
                                  : e.hasil === "rugi" ? "turun"
                                    : "netral"
                          }
                        >
                          {e.status === "tertutup" ? (e.hasil ?? "ditutup") : e.status}
                        </Lencana>
                        {e.idSaran ? <Lencana nada="info">dari saran AI</Lencana> : null}
                        <span className="text-[12px] text-ink-faint">{formatTanggal(e.tanggal)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSunting(e);
                            setFormTerbuka(true);
                          }}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface hover:text-ink"
                          aria-label={`Ubah entri ${e.ticker}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setAkanHapus(e)}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                          aria-label={`Hapus entri ${e.ticker}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
                      <span className="text-ink-faint">
                        Entry <span className="angka text-ink-soft">{formatUang(e.hargaEntry, e.mataUang)}</span>
                      </span>
                      <span className="text-ink-faint">
                        Stop <span className="angka text-turun">{formatUang(e.stopLoss, e.mataUang)}</span>
                      </span>
                      <span className="text-ink-faint">
                        Target <span className="angka text-naik">{formatUang(e.targetHarga, e.mataUang)}</span>
                      </span>
                      {rr !== null ? (
                        <span className="text-ink-faint">
                          R:R rencana <span className="angka text-ink-soft">1 : {rr.toFixed(2).replace(".", ",")}</span>
                        </span>
                      ) : null}
                      {e.hargaKeluar !== undefined ? (
                        <span className="text-ink-faint">
                          Keluar <span className="angka text-ink-soft">{formatUang(e.hargaKeluar, e.mataUang)}</span>
                        </span>
                      ) : null}
                      {r !== null ? (
                        <span className="text-ink-faint">
                          Hasil{" "}
                          <span className={cn("angka font-medium", r > 0 ? "text-naik" : r < 0 ? "text-turun" : "text-ink-soft")}>
                            {r > 0 ? "+" : ""}{formatAngka(r, 2)}R
                          </span>
                        </span>
                      ) : null}
                    </div>

                    {e.thesisTeknikal || e.thesisFundamental ? (
                      <div className="mt-3 grid gap-3 border-t border-bordr pt-3 sm:grid-cols-2">
                        {e.thesisTeknikal ? (
                          <div>
                            <p className="label-mikro">Teknikal</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.thesisTeknikal}</p>
                          </div>
                        ) : null}
                        {e.thesisFundamental ? (
                          <div>
                            <p className="label-mikro">Fundamental</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.thesisFundamental}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {e.pelajaran ? (
                      // Blok ini dulu berlatar aksen. Setelah aksen jadi merah,
                      // latar merah muda di bawah catatan pelajaran terbaca
                      // seperti peringatan kesalahan, padahal isinya justru hal
                      // yang ingin diingat. Sekarang penandanya pita aksen di
                      // tepi kiri, latarnya netral.
                      <div className="mt-3 border-l-2 border-aksen bg-surface-2 px-3 py-2.5">
                        <p className="label-mikro text-aksen">Pelajaran</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.pelajaran}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Kosong
              ikon={<NotebookPen size={20} />}
              judul={jurnal.length ? "Tidak ada entri yang cocok" : "Jurnalmu masih kosong"}
              keterangan={
                jurnal.length
                  ? "Coba ubah saringannya."
                  : "Trade yang tidak ditulis alasannya tidak bisa dievaluasi. Tulis thesis-mu sebelum masuk, bukan sesudah."
              }
              aksi={
                jurnal.length ? undefined : (
                  <Tombol rupa="utama" onClick={() => setFormTerbuka(true)}>
                    <Plus size={15} />
                    Entri pertama
                  </Tombol>
                )
              }
            />
          )}
        </div>
      </Kartu>

      <FormJurnal
        terbuka={formulirTerbuka}
        tutup={tutupFormulir}
        sunting={sunting}
        modal={ringkasan.totalNilai}
      />

      <Panel
        terbuka={kalkulatorAktif}
        tutup={tutupKalkulator}
        judul="Kalkulator ukuran posisi"
        keterangan="Tentukan dulu berapa yang rela hilang, biar ukuran posisinya yang menyesuaikan."
      >
        <KalkulatorRisiko
          modalAwal={ringkasan.totalNilai}
          mataUangAwal={pengaturan.mataUangDasar}
          kurs={kurs}
        />
      </Panel>

      <Panel
        terbuka={akanHapus !== null}
        tutup={() => setAkanHapus(null)}
        judul="Hapus entri jurnal ini?"
        keterangan="Win rate dan ekspektansi akan dihitung ulang tanpa entri ini."
      >
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setAkanHapus(null)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              if (akanHapus) await hapus("jurnal", akanHapus.id);
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
