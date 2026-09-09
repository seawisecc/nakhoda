"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import type { KonteksRiset } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { perintahTerminal } from "@/lib/riset";
import { Kartu, JudulKartu, Tombol } from "@/components/ui/dasar";

const JALUR_BAWAAN = "~/Desktop/Seawise Studio/nakhoda";

/** Perintah riset siap tempel.
 *
 *  Jalur ini interaktif, dan itu kelebihannya dibanding watcher: kamu melihat
 *  risetnya berjalan, bisa membantah kesimpulannya, dan tidak ada yang
 *  tersimpan sebelum kamu setuju. Watcher berguna kalau kamu ingin memintanya
 *  dari HP; ini berguna kalau kamu memang sedang di depan laptop. */
export function PerintahRiset() {
  const { posisiAktif, jurnal, saran, ringkasan, dietz, pengaturan } = usePortofolio();
  const [tersalin, setTersalin] = useState(false);
  const [gagalSalin, setGagalSalin] = useState(false);

  const perintah = useMemo(() => {
    const dipegang = new Set(posisiAktif.map((p) => p.ticker));
    const konteks: KonteksRiset = {
      mataUangDasar: pengaturan.mataUangDasar,
      totalNilai: ringkasan.totalNilai,
      kas: ringkasan.kas,
      targetBulananMin: pengaturan.targetBulananMin,
      targetBulananMax: pengaturan.targetBulananMax,
      returnBulanBerjalan: dietz.persen,
      // Jatah risiko dipatok 1% di sini. Perintah ini dibuat untuk ditempel
      // cepat; kalau mau angka lain, ubah saja di dalam prompt setelah ditempel.
      jatahRisiko: ringkasan.totalNilai * 0.01,
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
    return perintahTerminal(
      konteks,
      process.env.NEXT_PUBLIC_JALUR_REPO || JALUR_BAWAAN,
    );
  }, [posisiAktif, jurnal, saran, ringkasan, dietz, pengaturan]);

  async function salin() {
    setGagalSalin(false);
    try {
      await navigator.clipboard.writeText(perintah);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2500);
    } catch {
      // Clipboard API ditolak di konteks tidak aman atau tanpa izin. Perintahnya
      // tetap ada di layar dan bisa diblok manual, jadi ini bukan jalan buntu.
      setGagalSalin(true);
    }
  }

  if (!posisiAktif.length) return null;

  return (
    <Kartu>
      <JudulKartu
        judul="Minta riset lewat terminal"
        keterangan="Sudah berisi keadaan portofoliomu. Tempel ke terminal, hasilnya ditunjukkan dulu sebelum disimpan."
        aksi={
          <Tombol rupa="utama" ukuran="kecil" onClick={salin}>
            {tersalin ? <Check size={14} /> : <Copy size={14} />}
            {tersalin ? "Tersalin" : "Salin perintah"}
          </Tombol>
        }
      />

      <div className="mt-4 flex items-start gap-2.5 border border-bordr bg-surface-sunk p-3.5">
        <Terminal size={15} className="mt-0.5 shrink-0 text-aksen" />
        <pre className="angka max-h-40 min-w-0 flex-1 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap text-ink-faint">
          {perintah}
        </pre>
      </div>

      {gagalSalin ? (
        <p className="mt-2 text-[12px] text-peringatan">
          Browser menolak akses papan klip. Blok teks di atas dan salin manual.
        </p>
      ) : null}

      <p className="mt-3 text-[12px] text-ink-faint">
        Butuh <code className="text-aksen">GOOGLE_APPLICATION_CREDENTIALS</code> terisi.
      </p>
    </Kartu>
  );
}
