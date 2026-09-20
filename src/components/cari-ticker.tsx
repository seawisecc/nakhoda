"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { JenisAset } from "@/types";
import type { HasilCari } from "@/app/api/cari/route";
import { Isian } from "@/components/ui/dasar";
import { cn } from "@/lib/cn";

/** Kolom ticker yang juga menerima nama perusahaan atau nama koin.
 *
 *  Chart berganti saat satu hasil dipilih atau Enter ditekan, bukan di
 *  setiap huruf. Memilih hasil sekalian menyetel jenis asetnya, karena salah
 *  jenis berarti ticker saham dicari di bursa kripto dan chartnya kosong.
 *  Ticker yang diketik utuh tetap bisa dipakai lewat Enter, tanpa menunggu
 *  daftar hasilnya muncul. */
export function CariTicker({
  nilai, jenis, pilih, className,
}: {
  nilai: string;
  jenis: JenisAset;
  pilih: (t: { ticker: string; jenis: JenisAset }) => void;
  className?: string;
}) {
  const [kueri, setKueri] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilCari[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [terbuka, setTerbuka] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const idDaftar = useId();

  // Kueri null berarti belum diketik apa pun sejak dipasang, jadi kolomnya
  // menampilkan ticker yang sedang aktif, bukan string kosong.
  const teks = kueri ?? nilai;

  const k = kueri?.trim() ?? "";
  // Hasil lama disaring saat render, bukan dikosongkan dari dalam efek:
  // setState di badan efek memicu render berantai, dan hasilnya sama saja.
  const terlihat = k.length >= 2 ? hasil : [];

  useEffect(() => {
    if (k.length < 2) return;
    let batal = false;
    // Jeda 250ms: mengetik "micron" tanpa jeda mengirim enam permintaan, dan
    // lima di antaranya sudah tidak relevan sebelum balasannya sampai.
    const jam = setTimeout(() => {
      setMemuat(true);
      fetch(`/api/cari?q=${encodeURIComponent(k)}`)
        .then((r) => r.json())
        .then((j) => { if (!batal) setHasil(j.hasil ?? []); })
        .catch(() => { if (!batal) setHasil([]); })
        .finally(() => { if (!batal) setMemuat(false); });
    }, 250);
    return () => { batal = true; clearTimeout(jam); };
  }, [k]);

  useEffect(() => {
    if (!terbuka) return;
    const luar = (e: MouseEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setTerbuka(false);
    };
    document.addEventListener("mousedown", luar);
    return () => document.removeEventListener("mousedown", luar);
  }, [terbuka]);

  function ambil(h: HasilCari) {
    pilih({ ticker: h.ticker, jenis: h.jenis });
    setKueri(null);
    setTerbuka(false);
  }

  return (
    <div ref={wadah} className={cn("relative", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <Isian
        value={teks}
        onChange={(e) => {
          setKueri(e.target.value);
          setTerbuka(true);
        }}
        onFocus={() => setTerbuka(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setKueri(null);
            setTerbuka(false);
          }
          if (e.key !== "Enter") return;
          // Chart tidak berganti per huruf. Mengetik "micron" sebelumnya
          // sempat membuka chart koin bernama MI, lalu MIC, dan seterusnya,
          // masing-masing dengan pesan simbol tidak ditemukan. Enter memakai
          // hasil teratas, atau apa yang diketik kalau tidak ada hasil.
          if (terlihat.length) ambil(terlihat[0]);
          else if (k) {
            pilih({ ticker: k.toUpperCase(), jenis });
            setKueri(null);
            setTerbuka(false);
          }
        }}
        placeholder="Ticker atau nama"
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-expanded={terbuka && terlihat.length > 0}
        aria-controls={idDaftar}
        aria-label="Cari ticker, nama perusahaan, atau nama koin"
        className="h-9 w-full py-1.5 pl-8"
      />
      {memuat ? (
        <Loader2 size={13} className="absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-ink-faint" />
      ) : null}

      {terbuka && terlihat.length ? (
        <ul
          id={idDaftar}
          role="listbox"
          className="absolute top-[calc(100%+2px)] right-0 left-0 z-50 max-h-72 overflow-y-auto border border-bordr bg-surface shadow-[var(--nk-bayang-2)]"
        >
          {terlihat.map((h) => (
            <li key={`${h.jenis}-${h.ticker}`}>
              <button
                type="button"
                role="option"
                aria-selected={h.ticker === nilai}
                onClick={() => ambil(h)}
                className="flex w-full items-baseline gap-2 border-b border-bordr px-2.5 py-2 text-left transition last:border-0 hover:bg-surface-2"
              >
                <span className="angka shrink-0 text-[12px] font-medium text-ink">{h.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{h.nama}</span>
                <span className="label-mikro shrink-0">{h.jenis === "kripto" ? "kripto" : h.bursa}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
