"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Transaksi } from "@/types";
import { useData } from "@/lib/data/penyedia";
import { formatQty, formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { bersihkanParam, useParamKueri } from "@/lib/param";
import { Isian, Kartu, Kosong, Lencana, Pilihan, Tombol } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { FormTransaksi } from "@/components/formulir/form-transaksi";
import { Panel, KakiPanel } from "@/components/ui/panel";

export default function HalamanTransaksi() {
  const { transaksi, hapus } = useData();
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [sunting, setSunting] = useState<Transaksi | null>(null);
  const [akanHapus, setAkanHapus] = useState<Transaksi | null>(null);
  const [cari, setCari] = useState("");
  const [saringSisi, setSaringSisi] = useState<"semua" | "beli" | "jual">("semua");

  // Pintasan PWA dan tautan antar halaman membuka formulir lewat ?baru=1.
  // Nilainya dibaca sebagai turunan dari URL, bukan disalin ke state di dalam
  // efek, jadi formulir sudah terbuka sejak render pertama.
  const dariUrl = useParamKueri("baru") === "1";
  const formulirTerbuka = formTerbuka || dariUrl;

  function tutupFormulir() {
    setFormTerbuka(false);
    setSunting(null);
    bersihkanParam("baru");
  }

  const terlihat = useMemo(() => {
    const kunci = cari.trim().toUpperCase();
    return [...transaksi]
      .filter((t) => (saringSisi === "semua" ? true : t.sisi === saringSisi))
      .filter((t) => (kunci ? t.ticker.toUpperCase().includes(kunci) : true))
      .sort(
        (a, b) =>
          b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0),
      );
  }, [transaksi, cari, saringSisi]);

  return (
    <div className="space-y-4">
      <Kartu>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            />
            <Isian
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari ticker"
              className="pl-9"
              aria-label="Cari ticker"
            />
          </div>
          <Pilihan
            value={saringSisi}
            onChange={(e) => setSaringSisi(e.target.value as "semua" | "beli" | "jual")}
            className="w-auto min-w-32"
            aria-label="Saring aksi"
          >
            <option value="semua">Semua aksi</option>
            <option value="beli">Beli saja</option>
            <option value="jual">Jual saja</option>
          </Pilihan>
          <Tombol
            rupa="utama"
            onClick={() => {
              setSunting(null);
              setFormTerbuka(true);
            }}
          >
            <Plus size={15} />
            Transaksi baru
          </Tombol>
        </div>

        <div className="mt-4">
          {terlihat.length ? (
            <Tabel
              kepala={
                <>
                  <Th>Tanggal</Th>
                  <Th>Ticker</Th>
                  <Th>Aksi</Th>
                  <Th kanan>Jumlah</Th>
                  <Th kanan>Harga</Th>
                  <Th kanan>Fee</Th>
                  <Th kanan>Total</Th>
                  <Th kanan>Kelola</Th>
                </>
              }
            >
              {terlihat.map((t) => {
                const total = t.qty * t.harga + (t.sisi === "beli" ? t.fee : -t.fee);
                return (
                  <Tr key={t.id}>
                    <Td className="whitespace-nowrap">{formatTanggal(t.tanggal)}</Td>
                    <Td>
                      <span className="font-medium text-ink">{t.ticker}</span>
                      <span className="ml-2 text-[11px] text-ink-faint">
                        {t.jenisAset === "kripto" ? "kripto" : "saham"}
                      </span>
                      {t.catatan ? (
                        <p className="mt-0.5 line-clamp-1 max-w-56 text-[11px] text-ink-faint">
                          {t.catatan}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <Lencana nada={t.sisi === "beli" ? "naik" : "turun"}>{t.sisi}</Lencana>
                    </Td>
                    <Td kanan className="angka">{formatQty(t.qty)}</Td>
                    <Td kanan className="angka">{formatUang(t.harga, t.mataUang)}</Td>
                    <Td kanan className="angka">
                      {t.fee ? formatUang(t.fee, t.mataUang) : "—"}
                    </Td>
                    <Td kanan className="angka font-medium text-ink">
                      {formatUang(total, t.mataUang)}
                    </Td>
                    <Td kanan>
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => {
                            setSunting(t);
                            setFormTerbuka(true);
                          }}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface-2 hover:text-ink"
                          aria-label={`Ubah transaksi ${t.ticker} ${t.tanggal}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setAkanHapus(t)}
                          className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                          aria-label={`Hapus transaksi ${t.ticker} ${t.tanggal}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tabel>
          ) : (
            <Kosong
              ikon={<ArrowLeftRight size={20} />}
              judul={transaksi.length ? "Tidak ada yang cocok" : "Belum ada transaksi"}
              keterangan={
                transaksi.length
                  ? "Coba ubah kata kunci atau saringannya."
                  : "Setiap angka di Nakhoda diturunkan dari daftar ini. Mulai dari transaksi pertamamu."
              }
              aksi={
                transaksi.length ? undefined : (
                  <Tombol rupa="utama" onClick={() => setFormTerbuka(true)}>
                    <Plus size={15} />
                    Transaksi baru
                  </Tombol>
                )
              }
            />
          )}
        </div>
      </Kartu>

      <FormTransaksi terbuka={formulirTerbuka} tutup={tutupFormulir} sunting={sunting} />

      <Panel
        terbuka={akanHapus !== null}
        tutup={() => setAkanHapus(null)}
        judul="Hapus transaksi ini?"
        keterangan="Biaya rata-rata dan laba terealisasi seluruh posisi ini akan dihitung ulang tanpa baris tersebut."
      >
        {akanHapus ? (
          <div className="border border-bordr bg-surface-sunk px-4 py-3 text-[13px] text-ink-soft">
            <span className="font-medium text-ink">{akanHapus.ticker}</span> · {akanHapus.sisi}{" "}
            {formatQty(akanHapus.qty)} @ {formatUang(akanHapus.harga, akanHapus.mataUang)} ·{" "}
            {formatTanggal(akanHapus.tanggal)}
          </div>
        ) : null}
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setAkanHapus(null)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              if (akanHapus) await hapus("transaksi", akanHapus.id);
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
