"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, RefreshCw } from "lucide-react";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatPersen, formatQty, formatUang, tandaArah } from "@/lib/format";
import { formatTanggal, selangWaktu } from "@/lib/tanggal";
import { Kartu, Kosong, Lencana, PenandaTicker, Tombol, warnaArah } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { JalaUbin, Ubin } from "@/components/ui/statistik";
import { cn } from "@/lib/cn";

type Saring = "semua" | "saham" | "kripto" | "tertutup";

export default function HalamanPosisi() {
  const { posisi, ringkasan, pengaturan, menyegarkan, segarkanHarga, hargaTertua } = usePortofolio();
  const [saring, setSaring] = useState<Saring>("semua");

  const terlihat = posisi.filter((p) => {
    if (saring === "tertutup") return p.qty <= 0;
    if (p.qty <= 0) return false;
    if (saring === "semua") return true;
    return p.jenisAset === saring;
  });

  const dasar = pengaturan.mataUangDasar;

  return (
    <div className="space-y-4">
      <JalaUbin>
        <Ubin label="Nilai posisi" nilai={formatUang(ringkasan.nilaiPosisi, dasar, { ringkas: true })} />
        <Ubin
          label="Belum terealisasi"
          nilai={
            <span className={warnaArah(ringkasan.labaBelumTerealisasi)}>
              {formatUang(ringkasan.labaBelumTerealisasi, dasar, { ringkas: true })}
            </span>
          }
        />
        <Ubin
          label="Sudah terealisasi"
          nilai={
            <span className={warnaArah(ringkasan.labaTerealisasi)}>
              {formatUang(ringkasan.labaTerealisasi, dasar, { ringkas: true })}
            </span>
          }
        />
        <Ubin
          label="Posisi terbuka"
          nilai={posisi.filter((p) => p.qty > 0).length}
          sub={hargaTertua ? `harga ${selangWaktu(hargaTertua)}` : "harga belum diambil"}
        />
      </JalaUbin>

      <Kartu>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["semua", "Semua"],
              ["saham", "Saham AS"],
              ["kripto", "Kripto"],
              ["tertutup", "Sudah ditutup"],
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
          <Tombol ukuran="kecil" onClick={() => void segarkanHarga()} disabled={menyegarkan}>
            <RefreshCw size={13} className={menyegarkan ? "animate-spin" : undefined} />
            Segarkan harga
          </Tombol>
        </div>

        <div className="mt-4">
          {terlihat.length ? (
            <Tabel
              kepala={
                <>
                  <Th>Ticker</Th>
                  <Th kanan>Jumlah</Th>
                  <Th kanan>Harga rata-rata</Th>
                  <Th kanan>Harga kini</Th>
                  <Th kanan>Nilai pasar</Th>
                  <Th kanan>Belum terealisasi</Th>
                  <Th kanan>Terealisasi</Th>
                </>
              }
            >
              {terlihat.map((p) => (
                <Tr key={p.ticker}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <PenandaTicker
                        ticker={p.ticker}
                        jenisAset={p.jenisAset}
                        className="size-8"
                      />
                      <div>
                        <Link
                          href={`/chart?ticker=${encodeURIComponent(p.ticker)}&jenis=${p.jenisAset}`}
                          className="text-[14px] font-medium text-ink hover:text-aksen hover:underline"
                        >
                          {p.ticker}
                        </Link>
                        <p className="text-[11px] text-ink-faint">
                          {p.jenisAset === "kripto" ? "Kripto" : "Saham AS"} · sejak{" "}
                          {formatTanggal(p.tanggalPertama)}
                        </p>
                      </div>
                      {p.campurMataUang ? (
                        <Lencana nada="peringatan">
                          <span title="Ticker ini pernah ditransaksikan dalam dua mata uang. Nilai lama dikonversi memakai kurs hari ini, bukan kurs saat transaksi.">
                            campur kurs
                          </span>
                        </Lencana>
                      ) : null}
                    </div>
                  </Td>
                  <Td kanan className="angka">{formatQty(p.qty)}</Td>
                  <Td kanan className="angka">{formatUang(p.avgHarga, p.mataUang)}</Td>
                  <Td kanan className="angka">
                    {p.hargaTerakhir !== undefined ? formatUang(p.hargaTerakhir, p.mataUang) : "—"}
                  </Td>
                  <Td kanan className="angka font-medium text-ink">
                    {formatUang(p.nilaiPasar ?? p.biayaTotal, p.mataUang)}
                  </Td>
                  <Td kanan>
                    {p.labaBelumTerealisasi === undefined ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span className={cn("angka font-medium", warnaArah(p.labaBelumTerealisasi))}>
                        <span aria-hidden>{tandaArah(p.labaBelumTerealisasi)}</span>{" "}
                        {formatUang(Math.abs(p.labaBelumTerealisasi), p.mataUang)}
                        <span className="ml-1 opacity-70">
                          {formatPersen(p.labaBelumTerealisasiPersen ?? 0)}
                        </span>
                      </span>
                    )}
                  </Td>
                  <Td kanan>
                    <span className={cn("angka", warnaArah(p.labaTerealisasi))}>
                      {p.labaTerealisasi === 0 ? "—" : formatUang(p.labaTerealisasi, p.mataUang)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tabel>
          ) : (
            <Kosong
              ikon={<Layers size={20} />}
              judul={saring === "tertutup" ? "Belum ada posisi yang ditutup" : "Belum ada posisi di kategori ini"}
              keterangan="Posisi muncul otomatis begitu kamu mencatat transaksi beli."
              aksi={
                <Link href="/transaksi?baru=1">
                  <Tombol rupa="utama" ukuran="kecil">Catat transaksi</Tombol>
                </Link>
              }
            />
          )}
        </div>
      </Kartu>
    </div>
  );
}
