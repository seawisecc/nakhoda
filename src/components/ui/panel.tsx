"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Panel modal.
 *
 *  Di layar lebar dia kartu di tengah; di ponsel dia lembar yang naik dari
 *  bawah, karena formulir di ponsel dipakai dengan satu ibu jari dan tombol
 *  simpannya harus berada di jangkauan bawah, bukan di puncak layar. */
export function Panel({
  terbuka, tutup, judul, keterangan, children, lebar = "sedang",
}: {
  terbuka: boolean;
  tutup: () => void;
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
  lebar?: "sedang" | "lebar" | "penuh";
}) {
  const isi = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terbuka) return;

    const sebelumnya = document.activeElement as HTMLElement | null;
    const bantalan = window.innerWidth - document.documentElement.clientWidth;
    const gayaLama = document.body.style.cssText;
    // Mengunci gulir halaman tanpa menambah bantalan akan menggeser seluruh
    // layout begitu scrollbar hilang, dan pergeseran itu sangat terasa.
    document.body.style.overflow = "hidden";
    if (bantalan > 0) document.body.style.paddingRight = `${bantalan}px`;

    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        tutup();
        return;
      }
      if (e.key !== "Tab" || !isi.current) return;
      const bisaFokus = isi.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!bisaFokus.length) return;
      const awal = bisaFokus[0];
      const akhir = bisaFokus[bisaFokus.length - 1];
      if (e.shiftKey && document.activeElement === awal) {
        e.preventDefault();
        akhir.focus();
      } else if (!e.shiftKey && document.activeElement === akhir) {
        e.preventDefault();
        awal.focus();
      }
    };

    document.addEventListener("keydown", tekan, true);
    const jam = window.setTimeout(() => {
      isi.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", tekan, true);
      window.clearTimeout(jam);
      document.body.style.cssText = gayaLama;
      sebelumnya?.focus?.();
    };
  }, [terbuka, tutup]);

  if (!terbuka) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={judul}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={tutup}
        aria-label="Tutup"
        tabIndex={-1}
      />
      <div
        ref={isi}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-e3",
          "border border-bordr-strong",
          lebar === "penuh" ? "sm:max-w-6xl" : lebar === "lebar" ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-bordr bg-surface-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="label-mikro text-[11px] text-ink">{judul}</h2>
            {keterangan ? (
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">{keterangan}</p>
            ) : null}
          </div>
          <button
            onClick={tutup}
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center text-ink-faint transition hover:bg-surface-2 hover:text-ink"
            aria-label="Tutup"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Baris tombol di kaki formulir. Simpan selalu di kanan pada layar lebar dan
 *  memenuhi lebar pada ponsel. */
export function KakiPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-bordr pt-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
