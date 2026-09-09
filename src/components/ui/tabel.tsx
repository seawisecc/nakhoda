"use client";

import { cn } from "@/lib/cn";

/** Pembungkus tabel.
 *
 *  Tabel angka di ponsel selalu lebih lebar dari layar. Yang tidak boleh
 *  terjadi adalah seluruh halaman ikut bergeser ke samping; jadi guliran
 *  horizontalnya dikurung di sini, bukan di body.
 *
 *  Margin negatifnya mengikuti padding panel (p-4), supaya kepala dan garis
 *  barisnya membentang penuh sampai tepi panel. Tabel yang garisnya berhenti
 *  sebelum tepi terbaca sebagai daftar yang ditempel di dalam kartu; tabel
 *  yang garisnya menyentuh tepi terbaca sebagai isi panel itu sendiri. */
export function Tabel({
  kepala, children, className,
}: {
  kepala: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4">
      <table className={cn("w-full min-w-[640px] border-collapse text-[12px]", className)}>
        <thead>
          <tr className="border-y border-bordr bg-surface-2 text-left">{kepala}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children, kanan, className,
}: {
  children: React.ReactNode;
  kanan?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn("label-mikro px-3 py-2 font-medium", kanan && "text-right", className)}
    >
      {children}
    </th>
  );
}

export function Td({
  children, kanan, className,
}: {
  children: React.ReactNode;
  kanan?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-2 align-middle text-ink-soft", kanan && "text-right", className)}>
      {children}
    </td>
  );
}

export function Tr({
  children, className, ...sisa
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-bordr transition-colors last:border-0 hover:bg-surface-2", className)}
      {...sisa}
    >
      {children}
    </tr>
  );
}
