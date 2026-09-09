"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ── Panel ──────────────────────────────────────────────────────────── */

export function Kartu({
  children, className, isi = true, ...sisa
}: { children: ReactNode; className?: string; isi?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("kartu", isi && "p-4", className)} {...sisa}>
      {children}
    </div>
  );
}

/** Kepala panel.
 *
 *  Garis di bawah judul membentang penuh sampai tepi panel, bukan hanya
 *  selebar teks. Itu yang membedakan panel instrumen dari kartu berjudul:
 *  kepalanya adalah bidang tersendiri, bukan paragraf pertama.
 *
 *  `melekat` menempelkan kepala ke tepi atas panel. Dimatikan kalau kepala ini
 *  bukan anak pertama panel, karena margin negatifnya akan menabrak isi di
 *  atasnya. */
export function JudulKartu({
  judul, keterangan, aksi, melekat = true, className,
}: {
  judul: ReactNode;
  keterangan?: ReactNode;
  aksi?: ReactNode;
  melekat?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 mb-4 flex items-start justify-between gap-3 border-b border-bordr px-4 pb-2.5",
        melekat && "-mt-4 pt-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="label-mikro text-ink-soft">{judul}</h2>
        {keterangan ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">{keterangan}</p>
        ) : null}
      </div>
      {aksi ? <div className="shrink-0">{aksi}</div> : null}
    </div>
  );
}

/* ── Tombol ─────────────────────────────────────────────────────────── */

type Rupa = "utama" | "kedua" | "hantu" | "bahaya";
type Ukuran = "kecil" | "sedang" | "besar";

const RUPA: Record<Rupa, string> = {
  utama: "bg-aksen-isi text-aksen-di-isi hover:brightness-110 active:brightness-95 font-semibold",
  kedua:
    "bg-surface-2 text-ink border border-bordr-strong hover:bg-surface-sunk",
  hantu: "text-ink-soft hover:text-ink hover:bg-surface-2",
  bahaya: "bg-turun-lembut text-turun border border-turun/45 hover:brightness-105",
};

/* Label tombol ikut aturan tipografi sistem ini: mono, huruf besar, tracking
   lebar. Karena itu ukuran hurufnya diturunkan satu tingkat dibanding sistem
   lama; huruf besar semua selalu terbaca lebih besar daripada ukurannya. */
const UKURAN: Record<Ukuran, string> = {
  kecil: "h-7 px-2.5 text-[10px] gap-1.5",
  sedang: "h-9 px-3.5 text-[11px] gap-2",
  besar: "h-11 px-5 text-[12px] gap-2",
};

export function Tombol({
  rupa = "kedua", ukuran = "sedang", className, children, ...sisa
}: {
  rupa?: Rupa;
  ukuran?: Ukuran;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-mono tracking-[0.1em] whitespace-nowrap uppercase transition",
        "disabled:pointer-events-none disabled:opacity-45",
        RUPA[rupa], UKURAN[ukuran], className,
      )}
      {...sisa}
    >
      {children}
    </button>
  );
}

/* ── Isian formulir ─────────────────────────────────────────────────── */

/* Isian memakai --nk-border-strong, bukan --nk-border. Tepi kontrol adalah
   satu-satunya garis di sistem ini yang tunduk ke kontras 3:1: tanpa tepinya,
   sebuah isian di atas kertas tidak bisa dibedakan dari bidang biasa. */
const GAYA_ISIAN =
  "w-full border border-bordr-strong bg-surface-sunk px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-faint transition " +
  "hover:border-ink-faint focus:border-aksen focus:outline-none " +
  "disabled:opacity-50";

export function Bidang({
  label, petunjuk, galat, wajib, children, className,
}: {
  label: string;
  petunjuk?: ReactNode;
  galat?: string | null;
  wajib?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label-mikro mb-1.5 flex items-baseline gap-1 text-ink-soft">
        {label}
        {wajib ? <span className="text-aksen">*</span> : null}
      </span>
      {children}
      {galat ? (
        <span className="mt-1.5 block text-[12px] text-turun">{galat}</span>
      ) : petunjuk ? (
        <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-faint">{petunjuk}</span>
      ) : null}
    </label>
  );
}

export function Isian({ className, ...sisa }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(GAYA_ISIAN, className)} {...sisa} />;
}

/** Isian khusus angka. Memakai inputMode desimal supaya papan tik ponsel
 *  membuka lapisan angka, tapi tetap type="text" supaya "1.250,5" gaya
 *  Indonesia tidak ditolak browser sebagai bukan angka. */
export function IsianAngka({ className, ...sisa }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn(GAYA_ISIAN, "angka", className)}
      {...sisa}
    />
  );
}

/* Tanda panah digambar sebagai data URI, bukan sebagai ikon React yang
 * ditumpuk di atas select. Ikon yang ditumpuk butuh pembungkus relatif di
 * setiap tempat select dipakai, dan pembungkus itu selalu terlupa di satu
 * dua tempat. currentColor tidak bisa dipakai di dalam data URI, jadi
 * warnanya diambil dari nilai yang cukup terbaca di kedua tema. */
const PANAH =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23807b6f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function Pilihan({ className, children, ...sisa }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(GAYA_ISIAN, "cursor-pointer appearance-none pr-9", className)}
      style={{
        backgroundImage: PANAH,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.85rem center",
      }}
      {...sisa}
    >
      {children}
    </select>
  );
}

export function AreaTeks({ className, ...sisa }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(GAYA_ISIAN, "min-h-24 resize-y leading-relaxed", className)} {...sisa} />;
}

/* ── Lencana ────────────────────────────────────────────────────────── */

type NadaLencana = "netral" | "aksen" | "naik" | "turun" | "info" | "peringatan";

const NADA: Record<NadaLencana, string> = {
  netral: "bg-surface-2 text-ink-soft border-bordr",
  aksen: "bg-aksen-lembut text-aksen border-aksen/35",
  naik: "bg-naik-lembut text-naik border-naik/35",
  turun: "bg-turun-lembut text-turun border-turun/35",
  info: "bg-surface-2 text-info border-info/35",
  peringatan: "bg-surface-2 text-peringatan border-peringatan/40",
};

export function Lencana({
  nada = "netral", children, className,
}: {
  nada?: NadaLencana;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("chip", NADA[nada], className)}>{children}</span>;
}

/** Penanda keadaan langsung. Titik berdenyut plus kata, bukan titik saja:
 *  penanda yang hanya berupa titik berwarna tidak berarti apa-apa sampai
 *  seseorang menghafal artinya. */
export function ChipStatus({
  nada = "netral", denyut, children, className, ...sisa
}: {
  nada?: NadaLencana;
  denyut?: boolean;
  children: ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("chip", NADA[nada], className)} {...sisa}>
      <span
        className={cn("size-1.5 shrink-0 bg-current", denyut && "denyut")}
        aria-hidden
      />
      {children}
    </span>
  );
}

/* ── Keadaan kosong ─────────────────────────────────────────────────── */

export function Kosong({
  ikon, judul, keterangan, aksi,
}: {
  ikon?: ReactNode;
  judul: string;
  keterangan?: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {ikon ? (
        <div className="mb-4 grid size-11 place-items-center border border-bordr bg-surface-2 text-ink-faint">
          {ikon}
        </div>
      ) : null}
      <p className="text-[14px] font-medium text-ink">{judul}</p>
      {keterangan ? (
        <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-ink-faint">{keterangan}</p>
      ) : null}
      {aksi ? <div className="mt-5">{aksi}</div> : null}
    </div>
  );
}

/* ── Penanda ticker ─────────────────────────────────────────────────── */

/** Kotak berisi kode ticker.
 *
 *  Ticker AS hampir selalu satu sampai empat huruf, jadi empat huruf muat utuh
 *  kalau ukuran hurufnya diturunkan sedikit. Memotong paksa jadi tiga huruf
 *  membuat NVDA tampil sebagai "NVD" dan MSFT sebagai "MSF", dan kode yang
 *  dipotong justru lebih sulit dikenali daripada kode yang hurufnya kecil.
 *
 *  Kotaknya tidak lagi diisi penuh warna seri. Di sistem ini bidang berwarna
 *  pekat dipakai untuk data, bukan untuk hiasan baris; jadi jenis aset dibawa
 *  oleh pita 2px di tepi kiri, dan kotaknya sendiri tetap netral. Warnanya
 *  tetap bukan satu-satunya penanda, kodenya tertulis di dalam kotak. */
export function PenandaTicker({
  ticker, jenisAset, className,
}: {
  ticker: string;
  jenisAset: "saham" | "kripto";
  className?: string;
}) {
  const teks = ticker.length <= 4 ? ticker : ticker.slice(0, 4);
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center border border-bordr bg-surface-2 font-mono font-medium tracking-tight text-ink-soft",
        teks.length >= 4 ? "text-[9px]" : "text-[11px]",
        className ?? "size-9",
      )}
      aria-hidden
    >
      <span
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{
          background: jenisAset === "kripto" ? "var(--nk-seri-2)" : "var(--nk-seri-1)",
        }}
      />
      {teks}
    </span>
  );
}

/* ── Angka dengan arah ──────────────────────────────────────────────── */

export function warnaArah(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return "text-ink-faint";
  if (nilai > 0) return "text-naik";
  if (nilai < 0) return "text-turun";
  return "text-ink-soft";
}
