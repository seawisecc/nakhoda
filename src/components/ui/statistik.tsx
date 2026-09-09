"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatPersen, tandaArah } from "@/lib/format";
import { warnaArah } from "./dasar";

/** Jala ubin.
 *
 *  Ubin tidak lagi menggambar tepinya sendiri, dan itu bukan penyederhanaan:
 *  pada kepadatan setinggi ini, dua ubin bersebelahan yang masing-masing punya
 *  border akan menghasilkan garis dobel di setiap pertemuan, dan garis dobel
 *  itulah yang bikin grid terlihat kotor. Di sini garis pemisahnya adalah latar
 *  jala yang menembus lewat jarak 1px, jadi setiap persimpangan tetap satu
 *  garis. Lihat kelas .jala di globals.css.
 *
 *  Konsekuensinya: Ubin HARUS berada di dalam JalaUbin. Ubin yang dipasang
 *  langsung di grid biasa akan tampak melayang tanpa tepi. */
export function JalaUbin({
  children, className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("jala grid-cols-2 lg:grid-cols-4", className)}>{children}</div>
  );
}

/** Ubin statistik.
 *
 *  Bukan chart, dan memang tidak boleh jadi chart: satu angka tunggal paling
 *  terbaca sebagai angka besar, bukan sebagai batang setinggi satu batang. */
export function Ubin({
  label, nilai, sub, delta, nada = "biasa", ikon, className,
}: {
  label: string;
  nilai: ReactNode;
  sub?: ReactNode;
  /** Persentase perubahan. Ditampilkan dengan tanda ▲/▼, bukan warna saja. */
  delta?: number | null;
  nada?: "biasa" | "arah";
  ikon?: ReactNode;
  className?: string;
}) {
  const warna =
    nada === "arah" && typeof nilai === "number" ? warnaArah(nilai) : "text-ink";

  return (
    <div className={cn("px-3.5 py-3", className)}>
      <div className="flex items-center gap-1.5">
        {ikon ? <span className="text-ink-faint">{ikon}</span> : null}
        <span className="label-mikro truncate">{label}</span>
      </div>
      <div className={cn("angka mt-2 text-[20px] leading-none font-semibold", warna)}>
        {nilai}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && delta !== null && Number.isFinite(delta) ? (
          <span className={cn("angka text-[11px] font-medium", warnaArah(delta))}>
            <span aria-hidden>{tandaArah(delta)}</span> {formatPersen(Math.abs(delta), 2, false)}
          </span>
        ) : null}
        {sub ? <span className="text-[11px] leading-snug text-ink-faint">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Baris label-nilai di dalam panel. Dipakai untuk rincian yang tidak layak
 *  jadi ubin sendiri. Pemisahnya hairline penuh, bukan jarak kosong, supaya
 *  daftar ini terbaca sebagai tabel satu kolom. */
export function Baris({
  label, nilai, petunjuk, className,
}: {
  label: ReactNode;
  nilai: ReactNode;
  petunjuk?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-bordr py-1.5 last:border-0",
        className,
      )}
    >
      <span className="text-[12px] text-ink-soft" title={petunjuk}>
        {label}
      </span>
      <span className="angka text-[12px] font-medium text-ink">{nilai}</span>
    </div>
  );
}
