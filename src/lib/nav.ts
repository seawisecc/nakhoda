import {
  ArrowLeftRight, CandlestickChart, ClipboardCheck, LayoutDashboard, Layers,
  NotebookPen, Settings, Sparkles, Wallet, type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  href: string;
  label: string;
  labelPendek: string;
  ikon: LucideIcon;
  /** Muncul di bilah bawah ponsel. Sisanya masuk menu "Lainnya". */
  utama?: boolean;
}

export const NAV: ItemNav[] = [
  { href: "/", label: "Dasbor", labelPendek: "Dasbor", ikon: LayoutDashboard, utama: true },
  { href: "/tinjauan", label: "Tinjauan", labelPendek: "Tinjauan", ikon: ClipboardCheck, utama: true },
  { href: "/posisi", label: "Posisi", labelPendek: "Posisi", ikon: Layers },
  { href: "/transaksi", label: "Transaksi", labelPendek: "Transaksi", ikon: ArrowLeftRight, utama: true },
  { href: "/modal", label: "Modal", labelPendek: "Modal", ikon: Wallet },
  { href: "/jurnal", label: "Jurnal", labelPendek: "Jurnal", ikon: NotebookPen, utama: true },
  { href: "/saran", label: "Saran AI", labelPendek: "Saran", ikon: Sparkles },
  { href: "/chart", label: "Chart & TA", labelPendek: "Chart", ikon: CandlestickChart },
  { href: "/pengaturan", label: "Pengaturan", labelPendek: "Atur", ikon: Settings },
];

export function judulHalaman(path: string): string {
  const cocok = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));
  return cocok?.label ?? "Nakhoda";
}
