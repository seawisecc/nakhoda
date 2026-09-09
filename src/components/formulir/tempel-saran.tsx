"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Copy, Check, Trash2, Wand2 } from "lucide-react";
import type { BarisUrai } from "@/lib/hitung/urai-saran";
import type { JenisAset, Rekomendasi, Saran } from "@/types";
import { uraiSaran } from "@/lib/hitung/urai-saran";
import { rrRencana } from "@/lib/hitung/kinerja";
import { useData, buatId } from "@/lib/data/penyedia";
import { usePortofolio } from "@/lib/data/portofolio";
import { bacaAngka, formatAngka } from "@/lib/format";
import { hariIni } from "@/lib/tanggal";
import {
  AreaTeks, Bidang, Isian, IsianAngka, Lencana, Pilihan, Tombol,
} from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { cn } from "@/lib/cn";

/** Prompt yang bisa ditempel ke AI lain supaya balasannya rapi.
 *  Penguraian bebas tetap bekerja tanpa ini, tapi keluaran yang sudah
 *  berbentuk tabel jauh lebih jarang butuh koreksi tangan. */
function promptUntukAiLain(daftarPosisi: string): string {
  return [
    "Saya punya portofolio berisi: " + (daftarPosisi || "(belum ada posisi)") + ".",
    "",
    "Tolong beri analisis dan rekomendasi. Balas HANYA dengan tabel markdown",
    "berkolom persis seperti ini, satu baris per aset:",
    "",
    "| Ticker | Rekomendasi | Entry | Stop Loss | Target | Analisis |",
    "|---|---|---|---|---|---|",
    "| NVDA | Beli | 228.45 | 210 | 265 | alasan singkat |",
    "",
    "Aturan: rekomendasi hanya boleh Beli, Jual, Tahan, atau Pantau.",
    "Untuk Beli dan Jual, entry, stop, dan target wajib berupa angka.",
    "Sebutkan juga apa yang akan membatalkan analisismu di kolom Analisis.",
    "Tinjau juga posisi yang sudah saya pegang, mana yang sebaiknya dilepas.",
  ].join("\n");
}

type BarisSunting = BarisUrai & { pilih: boolean };

export function TempelSaran() {
  const { simpan, pengguna } = useData();
  const { posisiAktif } = usePortofolio();
  const [terbuka, setTerbuka] = useState(false);

  return (
    <>
      <Tombol onClick={() => setTerbuka(true)}>
        <ClipboardPaste size={15} />
        Tempel dari AI lain
      </Tombol>
      <Panel
        terbuka={terbuka}
        tutup={() => setTerbuka(false)}
        judul="Tempel saran dari AI lain"
        keterangan="Tempel mentahannya apa adanya. Yang tidak ketemu ditandai, bukan ditebak."
        lebar="penuh"
      >
        <IsiTempel
          tutup={() => setTerbuka(false)}
          simpan={simpan}
          uid={pengguna?.uid ?? "lokal"}
          ringkasanPosisi={posisiAktif
            .map((p) => `${p.ticker} (${p.jenisAset}, rata-rata ${p.mataUang} ${p.avgHarga.toFixed(2)})`)
            .join(", ")}
        />
      </Panel>
    </>
  );
}

function IsiTempel({
  tutup, simpan, uid, ringkasanPosisi,
}: {
  tutup: () => void;
  simpan: <T extends { id: string }>(k: "saran", d: T) => Promise<void>;
  uid: string;
  ringkasanPosisi: string;
}) {
  const [sumber, setSumber] = useState("");
  const [mentah, setMentah] = useState("");
  const [baris, setBaris] = useState<BarisSunting[] | null>(null);
  const [takTerbaca, setTakTerbaca] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const prompt = useMemo(() => promptUntukAiLain(ringkasanPosisi), [ringkasanPosisi]);

  function uraikan() {
    const h = uraiSaran(mentah);
    setBaris(h.baris.map((b) => ({ ...b, pilih: true })));
    setTakTerbaca(h.takTerbaca);
  }

  function ubah(id: string, ubahan: Partial<BarisSunting>) {
    setBaris((s) => s?.map((b) => (b.id === id ? { ...b, ...ubahan } : b)) ?? null);
  }

  const terpilih = baris?.filter((b) => b.pilih) ?? [];

  async function simpanSemua() {
    setSibuk(true);
    try {
      for (const b of terpilih) {
        const dok: Saran = {
          id: buatId(),
          uid,
          ticker: b.ticker.trim().toUpperCase(),
          jenisAset: b.jenisAset,
          tanggal: hariIni(),
          sumber: sumber.trim() || "manual",
          rekomendasi: b.rekomendasi ?? "pantau",
          catatanTeknikal: b.catatan,
          catatanFundamental: "",
          mataUang: b.mataUang,
          status: "menunggu",
          dibuatPada: Date.now(),
        };
        if (b.entry !== null) dok.entrySaran = b.entry;
        if (b.stop !== null) dok.stopSaran = b.stop;
        if (b.target !== null) dok.targetSaran = b.target;
        await simpan("saran", dok);
      }
      tutup();
    } finally {
      setSibuk(false);
    }
  }

  if (baris === null) {
    return (
      <div className="space-y-4">
        <div className="border border-bordr bg-surface-sunk p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-md text-[13px] text-ink-soft">
              Salin prompt ini ke AI mana pun supaya balasannya langsung berbentuk tabel.
            </p>
            <Tombol
              ukuran="kecil"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt);
                  setTersalin(true);
                  window.setTimeout(() => setTersalin(false), 2000);
                } catch {
                  setTersalin(false);
                }
              }}
            >
              {tersalin ? <Check size={13} /> : <Copy size={13} />}
              {tersalin ? "Tersalin" : "Salin prompt"}
            </Tombol>
          </div>
        </div>

        <Bidang label="Sumbernya dari mana" petunjuk="Nama AI-nya. Dipakai untuk membandingkan siapa yang lebih sering benar.">
          <Isian
            value={sumber}
            onChange={(e) => setSumber(e.target.value)}
            placeholder="ChatGPT, Gemini, Grok, analis X"
          />
        </Bidang>

        <Bidang label="Tempel mentahannya" wajib petunjuk="Tabel, JSON, atau paragraf biasa. Semua bentuk dicoba.">
          <AreaTeks
            value={mentah}
            onChange={(e) => setMentah(e.target.value)}
            rows={10}
            className="min-h-52 font-mono text-[12px]"
            placeholder={"| Ticker | Rekomendasi | Entry | Stop | Target |\n|---|---|---|---|---|\n| NVDA | Beli | 228.45 | 210 | 265 |"}
          />
        </Bidang>

        <KakiPanel>
          <Tombol type="button" rupa="hantu" onClick={tutup}>Batal</Tombol>
          <Tombol rupa="utama" onClick={uraikan} disabled={!mentah.trim()}>
            <Wand2 size={15} />
            Uraikan
          </Tombol>
        </KakiPanel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {baris.length === 0 ? (
        <div className="border border-peringatan/30 bg-surface-2 p-4">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Tidak ada ticker yang bisa dikenali dari teks itu. Coba pakai prompt bertabel
            supaya balasannya terstruktur, atau tempel bagian yang memuat kode asetnya saja.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-soft">
              {baris.length} aset terbaca dari{" "}
              <span className="text-ink">{sumber.trim() || "sumber tanpa nama"}</span>. Periksa
              dan lengkapi yang kosong sebelum disimpan.
            </p>
            <Lencana nada={terpilih.length ? "info" : "netral"}>{terpilih.length} dipilih</Lencana>
          </div>

          <Tabel
            className="min-w-[780px]"
            kepala={
              <>
                <Th>Simpan</Th>
                <Th>Ticker</Th>
                <Th>Jenis</Th>
                <Th>Rekomendasi</Th>
                <Th kanan>Entry</Th>
                <Th kanan>Stop</Th>
                <Th kanan>Target</Th>
                <Th kanan>R:R</Th>
                <Th kanan>Buang</Th>
              </>
            }
          >
            {baris.map((b) => {
              const rr =
                b.entry !== null && b.stop !== null && b.target !== null
                  ? rrRencana({ hargaEntry: b.entry, stopLoss: b.stop, targetHarga: b.target })
                  : null;
              const perluAngka = b.rekomendasi === "beli" || b.rekomendasi === "jual";
              const rrTipis = rr !== null && rr < 1.5;

              return (
                <Tr key={b.id} className={cn(b.pilih ? "" : "opacity-45")}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={b.pilih}
                      onChange={(e) => ubah(b.id, { pilih: e.target.checked })}
                      className="size-4 accent-[var(--nk-aksen-isi)]"
                      aria-label={`Simpan ${b.ticker}`}
                    />
                  </Td>
                  <Td>
                    <Isian
                      value={b.ticker}
                      onChange={(e) => ubah(b.id, { ticker: e.target.value.toUpperCase() })}
                      className="h-8 w-20 px-2 py-1 text-[13px]"
                    />
                  </Td>
                  <Td>
                    <Pilihan
                      value={b.jenisAset}
                      onChange={(e) => ubah(b.id, { jenisAset: e.target.value as JenisAset })}
                      className="h-8 w-24 px-2 py-1 text-[13px]"
                    >
                      <option value="saham">Saham</option>
                      <option value="kripto">Kripto</option>
                    </Pilihan>
                  </Td>
                  <Td>
                    <Pilihan
                      value={b.rekomendasi ?? ""}
                      onChange={(e) =>
                        ubah(b.id, { rekomendasi: (e.target.value || null) as Rekomendasi | null })
                      }
                      className={cn(
                        "h-8 w-24 px-2 py-1 text-[13px]",
                        b.rekomendasi === null && "border-peringatan",
                      )}
                    >
                      <option value="">pilih</option>
                      <option value="beli">Beli</option>
                      <option value="jual">Jual</option>
                      <option value="tahan">Tahan</option>
                      <option value="pantau">Pantau</option>
                    </Pilihan>
                  </Td>
                  {(["entry", "stop", "target"] as const).map((f) => (
                    <Td key={f} kanan>
                      <IsianAngka
                        value={b[f] === null ? "" : String(b[f])}
                        onChange={(e) => {
                          const n = bacaAngka(e.target.value);
                          ubah(b.id, { [f]: Number.isFinite(n) ? n : null } as Partial<BarisSunting>);
                        }}
                        placeholder="—"
                        className={cn(
                          "h-8 w-[86px] px-2 py-1 text-right text-[13px]",
                          perluAngka && b[f] === null && "border-peringatan",
                        )}
                      />
                    </Td>
                  ))}
                  <Td kanan>
                    {rr === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span className={cn("angka font-medium", rrTipis ? "text-turun" : "text-naik")}>
                        1 : {formatAngka(rr, 2)}
                      </span>
                    )}
                  </Td>
                  <Td kanan>
                    <button
                      onClick={() => setBaris((s) => s?.filter((x) => x.id !== b.id) ?? null)}
                      className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                      aria-label={`Buang ${b.ticker}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </Tabel>

          {baris.some((b) => {
            const rr =
              b.entry !== null && b.stop !== null && b.target !== null
                ? rrRencana({ hargaEntry: b.entry, stopLoss: b.stop, targetHarga: b.target })
                : null;
            return b.pilih && ((rr !== null && rr < 1.5) || ((b.rekomendasi === "beli" || b.rekomendasi === "jual") && (b.entry === null || b.stop === null || b.target === null)));
          }) ? (
            <p className="flex items-start gap-2 border border-peringatan/30 bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-peringatan">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Ada baris beli atau jual tanpa stop, atau dengan R:R di bawah 1,5. Tetap disimpan,
              tapi tanpa stop tidak bisa dinilai lewat R-multiple.
            </p>
          ) : null}
        </>
      )}

      {takTerbaca.length ? (
        <details className="border border-bordr bg-surface-sunk px-4 py-3">
          <summary className="cursor-pointer text-[13px] text-ink-soft">
            {takTerbaca.length} bagian teks tidak menghasilkan baris apa pun
          </summary>
          <ul className="mt-2 space-y-1.5">
            {takTerbaca.map((t, n) => (
              <li key={n} className="text-[12px] leading-relaxed text-ink-faint">
                {t}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <KakiPanel>
        <Tombol type="button" rupa="hantu" onClick={() => setBaris(null)}>
          Kembali ke teks
        </Tombol>
        <Tombol rupa="utama" onClick={simpanSemua} disabled={sibuk || !terpilih.length}>
          {sibuk ? "Menyimpan" : `Simpan ${terpilih.length} saran`}
        </Tombol>
      </KakiPanel>
    </div>
  );
}
