"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CandlestickChart, Check, LayoutGrid, Rows3, Sparkles, Trash2, X,
} from "lucide-react";
import type { Saran } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { rrRencana } from "@/lib/hitung/kinerja";
import { Kartu, Kosong, Lencana, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";
import { FormJurnal } from "@/components/formulir/form-jurnal";
import { TempelSaran } from "@/components/formulir/tempel-saran";
import { SalinPrompt } from "@/components/salin-prompt";
import { cn } from "@/lib/cn";

type Saring = "menunggu" | "diambil" | "diabaikan" | "semua";
type Tampilan = "kartu" | "tabel";

/** Rasio imbalan terhadap risiko satu saran, atau null kalau angkanya belum
 *  lengkap. Dipakai kartu maupun tabel, jadi dihitung di satu tempat. */
function rasio(s: Saran): number | null {
  if (!s.entrySaran || !s.stopSaran || !s.targetSaran) return null;
  return rrRencana({
    hargaEntry: s.entrySaran,
    stopLoss: s.stopSaran,
    targetHarga: s.targetSaran,
  });
}

/** Nama host saja, supaya baris sumber tetap bisa dipindai. URL penuh di
 *  kartu sempit akan membungkus jadi tiga baris dan menenggelamkan isinya. */
function tuanRumah(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const NADA_REKOMENDASI = {
  beli: "naik", jual: "turun", tahan: "netral", pantau: "info",
} as const;

export default function HalamanSaran() {
  const { saran, jurnal, ringkasan, simpan, hapus } = usePortofolio();
  const [saring, setSaring] = useState<Saring>("menunggu");
  const [tampilan, setTampilan] = useState<Tampilan>("kartu");
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
          <div className="ml-auto flex items-center gap-2">
            {/* Dua tampilan untuk dua pertanyaan yang berbeda. Kartu untuk
                membaca satu hipotesis sampai selesai, tabel untuk
                membandingkan angka beberapa hipotesis sekaligus. */}
            <div className="flex border border-bordr">
              {([
                ["kartu", "Kartu", LayoutGrid],
                ["tabel", "Tabel", Rows3],
              ] as [Tampilan, string, typeof LayoutGrid][]).map(([nilai, label, Ikon]) => (
                <button
                  key={nilai}
                  onClick={() => setTampilan(nilai)}
                  aria-pressed={tampilan === nilai}
                  title={`Tampilan ${label.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition",
                    tampilan === nilai
                      ? "bg-surface-sunk text-ink"
                      : "text-ink-faint hover:text-ink-soft",
                  )}
                >
                  <Ikon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <SalinPrompt />
            <TempelSaran />
          </div>
        </div>

        <div className="mt-4">
          {terlihat.length === 0 ? (
            <Kosong
              ikon={<Sparkles size={20} />}
              judul={saran.length ? "Tidak ada saran di kategori ini" : "Belum ada saran masuk"}
              keterangan="Jalankan riset dari terminal, atau tempel hasil dari AI lain."
            />
          ) : tampilan === "tabel" ? (
            <TabelSaran
              daftar={terlihat}
              tandai={tandai}
              buatJurnal={setBuatJurnal}
              hapus={setAkanHapus}
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {terlihat.map((s) => {
                const rr = rasio(s);
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
                            R:R{" "}
                            <span
                              className={cn(
                                "angka",
                                // Aturan riset mematok minimal 1,5. Aturan yang
                                // tidak pernah menolak apa pun bukan aturan, jadi
                                // yang di bawah batas ditandai di layar juga,
                                // bukan cuma ditolak di script.
                                rr < 1.5 ? "text-peringatan" : "text-ink-soft",
                              )}
                            >
                              1 : {rr.toFixed(2).replace(".", ",")}
                            </span>
                          </span>
                        ) : null}
                        {s.horizonHari ? (
                          <span className="text-ink-faint">
                            Horizon <span className="angka text-ink-soft">{s.horizonHari} hari</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {rr !== null && rr < 1.5 ? (
                      <p className="mt-2 text-[12px] leading-relaxed text-peringatan">
                        Imbalannya kurang dari 1,5 kali risiko. Di bawah batas yang kamu tetapkan
                        sendiri.
                      </p>
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
                      {/* Pembatal diberi pita di tepi kiri, bukan latar berwarna.
                          Ini bukan peringatan bahwa ada yang salah, ini bagian
                          yang paling harus dibaca dari seluruh kartu: satu-satunya
                          isi yang membuat saran ini bisa dinilai belakangan. */}
                      {s.pembatalThesis ? (
                        <div className="border-l-2 border-bordr-strong pl-3">
                          <p className="label-mikro">Yang membatalkan</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{s.pembatalThesis}</p>
                        </div>
                      ) : null}
                    </div>

                    {s.rujukan?.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-bordr pt-3">
                        <span className="label-mikro">Sumber</span>
                        {s.rujukan.map((u, i) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[12px] text-aksen hover:underline"
                          >
                            {tuanRumah(u) || `sumber ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : null}

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


/* Tampilan tabel.
 *
 * Bukan sekadar kartu yang dipipihkan. Yang dijawab tabel adalah pertanyaan
 * lain: dari empat hipotesis yang menunggu, mana yang rasionya paling baik dan
 * mana yang horizonnya paling pendek. Untuk itu angkanya harus sejajar kolom,
 * dan catatan panjangnya justru harus keluar dari layar, bukan ikut masuk.
 * Yang tidak muat di tabel (thesis, pembatal, sumber) tetap ada di kartu.
 */
function TabelSaran({
  daftar, tandai, buatJurnal, hapus,
}: {
  daftar: readonly Saran[];
  tandai: (s: Saran, status: Saran["status"]) => Promise<void>;
  buatJurnal: (s: Saran) => void;
  hapus: (s: Saran) => void;
}) {
  const KEPALA = [
    "Ticker", "Rekomendasi", "Entry", "Stop", "Target", "R:R", "Horizon",
    "Tanggal", "Status", "",
  ];

  return (
    // Tabel finansial tidak boleh dipaksa muat dengan cara mengecilkan angka
    // atau memotong kolom. Kalau layarnya sempit, yang menggulir tabelnya,
    // bukan halamannya.
    <div className="-mx-4 -mb-4 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-bordr">
            {KEPALA.map((h, i) => (
              <th
                key={h || `aksi-${i}`}
                scope="col"
                className={cn("label-mikro px-3 py-2", i === 0 || i === 1 ? "text-left" : "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daftar.map((s) => {
            const rr = rasio(s);
            return (
              <tr key={s.id} className="border-b border-bordr last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2.5">
                  <span className="font-mono text-[13px] font-medium text-ink">{s.ticker}</span>
                  <span className="ml-2 text-[11px] text-ink-faint">
                    {s.jenisAset === "kripto" ? "kripto" : "saham"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Lencana nada={NADA_REKOMENDASI[s.rekomendasi]}>{s.rekomendasi}</Lencana>
                </td>
                <td className="angka px-3 py-2.5 text-right text-ink-soft">
                  {s.entrySaran ? formatUang(s.entrySaran, s.mataUang) : "—"}
                </td>
                <td className="angka px-3 py-2.5 text-right text-turun">
                  {s.stopSaran ? formatUang(s.stopSaran, s.mataUang) : "—"}
                </td>
                <td className="angka px-3 py-2.5 text-right text-naik">
                  {s.targetSaran ? formatUang(s.targetSaran, s.mataUang) : "—"}
                </td>
                <td
                  className={cn(
                    "angka px-3 py-2.5 text-right",
                    rr === null ? "text-ink-faint" : rr < 1.5 ? "text-peringatan" : "text-ink-soft",
                  )}
                >
                  {rr === null ? "—" : `1 : ${rr.toFixed(2).replace(".", ",")}`}
                </td>
                <td className="angka px-3 py-2.5 text-right text-ink-soft">
                  {s.horizonHari ? `${s.horizonHari} hari` : "—"}
                </td>
                <td className="angka px-3 py-2.5 text-right text-ink-faint">
                  {formatTanggal(s.tanggal)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {s.status === "menunggu" ? (
                    <span className="text-ink-faint">menunggu</span>
                  ) : (
                    <Lencana nada={s.status === "diambil" ? "info" : "netral"}>{s.status}</Lencana>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {s.status === "menunggu" ? (
                      <>
                        <button
                          onClick={() => buatJurnal(s)}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface hover:text-naik"
                          aria-label={`Ambil saran ${s.ticker} dan buat entri jurnal`}
                          title="Ambil, buat jurnal"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => void tandai(s, "diabaikan")}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface hover:text-ink"
                          aria-label={`Abaikan saran ${s.ticker}`}
                          title="Abaikan"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : null}
                    <Link
                      href={`/chart?ticker=${encodeURIComponent(s.ticker)}&jenis=${s.jenisAset}`}
                      className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface hover:text-ink"
                      aria-label={`Buka chart ${s.ticker}`}
                      title="Chart"
                    >
                      <CandlestickChart size={14} />
                    </Link>
                    <button
                      onClick={() => hapus(s)}
                      className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                      aria-label={`Hapus saran ${s.ticker}`}
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
