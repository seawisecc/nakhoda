"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { KonteksRiset, PermintaanRiset } from "@/types";
import { useData, buatId } from "@/lib/data/penyedia";
import { usePortofolio } from "@/lib/data/portofolio";
import { hariIni } from "@/lib/tanggal";
import { selangWaktu } from "@/lib/tanggal";
import { Kartu, JudulKartu, Lencana, Tombol } from "@/components/ui/dasar";

/** Tombol yang menitipkan permintaan riset ke Firestore.
 *
 *  Sengaja tidak berpura-pura memanggil Claude langsung. Yang dikerjakan
 *  tombol ini cuma menaruh permintaan; yang mengerjakannya adalah watcher di
 *  laptop. Kalau watcher-nya tidak hidup, permintaan akan tetap berstatus
 *  "menunggu", dan komponen ini mengatakannya apa adanya alih-alih memutar
 *  animasi memuat yang tidak pernah selesai. */
export function TombolRiset({ jatahRisiko }: { jatahRisiko: number }) {
  const { simpan, pengguna, permintaanRiset } = useData();
  const { posisiAktif, jurnal, saran, ringkasan, dietz, pengaturan } = usePortofolio();
  const [sibuk, setSibuk] = useState(false);

  const terakhir = useMemo(
    () => [...permintaanRiset].sort((a, b) => b.dibuatPada - a.dibuatPada)[0],
    [permintaanRiset],
  );
  const berjalan = terakhir && (terakhir.status === "menunggu" || terakhir.status === "diproses");

  async function minta() {
    setSibuk(true);
    try {
      const dipegang = new Set(posisiAktif.map((p) => p.ticker));
      const konteks: KonteksRiset = {
        mataUangDasar: pengaturan.mataUangDasar,
        totalNilai: ringkasan.totalNilai,
        kas: ringkasan.kas,
        targetBulananMin: pengaturan.targetBulananMin,
        targetBulananMax: pengaturan.targetBulananMax,
        returnBulanBerjalan: dietz.persen,
        jatahRisiko,
        posisi: posisiAktif.map((p) => {
          const j = jurnal.find((e) => e.ticker === p.ticker && e.status === "terbuka");
          return {
            ticker: p.ticker,
            jenisAset: p.jenisAset,
            qty: Number(p.qty.toPrecision(8)),
            avgHarga: Number(p.avgHarga.toPrecision(8)),
            mataUang: p.mataUang,
            ...(p.hargaTerakhir !== undefined
              ? { hargaTerakhir: Number(p.hargaTerakhir.toPrecision(8)) }
              : {}),
            ...(p.labaBelumTerealisasiPersen !== undefined
              ? { labaPersen: Number(p.labaBelumTerealisasiPersen.toFixed(2)) }
              : {}),
            ...(j ? { stopLoss: j.stopLoss, targetHarga: j.targetHarga } : {}),
          };
        }),
        pengawasan: [...new Set(saran.map((s) => s.ticker))].filter((t) => !dipegang.has(t)),
      };

      const dok: PermintaanRiset = {
        id: buatId(),
        uid: pengguna?.uid ?? "lokal",
        tanggal: hariIni(),
        status: "menunggu",
        konteks,
        dibuatPada: Date.now(),
      };
      await simpan("permintaanRiset", dok);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Kartu>
      <JudulKartu
        judul="Riset dari Claude Code"
        keterangan="Dikerjakan Claude Code di laptop. Hasilnya masuk ke halaman Saran."
        aksi={
          <Tombol rupa="utama" onClick={minta} disabled={sibuk || berjalan}>
            {sibuk || berjalan ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {berjalan ? "Sedang diproses" : "Minta riset"}
          </Tombol>
        }
      />

      {terakhir ? (
        <div className="mt-4 border border-bordr bg-surface-sunk px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {terakhir.status === "menunggu" ? (
              <>
                <Lencana nada="peringatan">menunggu watcher</Lencana>
                <span className="text-[13px] text-ink-soft">
                  Permintaan sudah tersimpan {selangWaktu(terakhir.dibuatPada)}, tapi belum
                  ada yang mengambilnya.
                </span>
              </>
            ) : terakhir.status === "diproses" ? (
              <>
                <Lencana nada="info">sedang dianalisis</Lencana>
                <span className="text-[13px] text-ink-soft">
                  Dimulai {selangWaktu(terakhir.diprosesPada ?? terakhir.dibuatPada)}. Riset
                  yang menelusuri web bisa makan beberapa menit.
                </span>
              </>
            ) : terakhir.status === "selesai" ? (
              <>
                <CheckCircle2 size={15} className="text-naik" />
                <span className="text-[13px] text-ink-soft">
                  Selesai {selangWaktu(terakhir.selesaiPada ?? terakhir.dibuatPada)}:{" "}
                  {terakhir.jumlahSaran
                    ? `${terakhir.jumlahSaran} hipotesis tersimpan.`
                    : "tidak ada yang dinilai layak, dan itu jawaban yang sah."}
                </span>
                {terakhir.jumlahSaran ? (
                  <Link href="/saran" className="text-[13px] text-aksen hover:underline">
                    lihat di Saran
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <AlertTriangle size={15} className="text-turun" />
                <span className="text-[13px] text-turun">
                  Gagal: {terakhir.pesanGagal ?? "tanpa pesan"}
                </span>
              </>
            )}
          </div>

          {terakhir.status === "menunggu" ? (
            <p className="mt-2.5 text-[12px] text-ink-faint">
              Jalankan <code className="text-aksen">npm run pantau</code> di folder Nakhoda.
            </p>
          ) : null}
        </div>
      ) : null}

    </Kartu>
  );
}
