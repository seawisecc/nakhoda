"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudOff, HardDrive, LogOut, MoreHorizontal, RefreshCw, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV, judulHalaman } from "@/lib/nav";
import { useData } from "@/lib/data/penyedia";
import { usePortofolio } from "@/lib/data/portofolio";
import { useDaring } from "@/lib/daring";
import { selangWaktu } from "@/lib/tanggal";
import { ChipStatus } from "@/components/ui/dasar";
import { Logo } from "./logo";
import { Jam } from "./jam";
import { TombolTema } from "./tombol-tema";
import { LayarMasuk } from "./masuk";

function aktifkan(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/* ── Rel samping, layar lebar ───────────────────────────────────────── */

function RelSamping({ path }: { path: string }) {
  return (
    <nav
      className="fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col items-center border-r border-bordr bg-surface py-4 lg:flex"
      aria-label="Navigasi utama"
    >
      <Link
        href="/"
        className="mb-5 grid size-10 place-items-center border border-aksen/40 bg-aksen-lembut text-aksen transition hover:bg-aksen-isi hover:text-aksen-di-isi"
        aria-label="Nakhoda, ke dasbor"
      >
        <Logo size={22} />
      </Link>

      <ul className="flex w-full flex-1 flex-col items-center gap-1">
        {NAV.map(({ href, labelPendek, label, ikon: Ikon }) => {
          const aktif = aktifkan(path, href);
          return (
            <li key={href} className="w-full px-2">
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "group relative flex flex-col items-center gap-1 py-2.5 transition",
                  aktif ? "bg-surface-2 text-aksen" : "text-ink-faint hover:bg-surface-2 hover:text-ink-soft",
                )}
                title={label}
              >
                {/* Penanda halaman aktif tidak hanya lewat warna: ada pita di
                    tepi kiri yang tetap terlihat kalau warna sulit dibedakan. */}
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-[2px] transition-opacity",
                    aktif ? "bg-aksen-isi opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <Ikon size={18} strokeWidth={aktif ? 2.2 : 1.7} />
                <span className="label-mikro text-[9px] text-current">{labelPendek}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ── Bilah bawah, ponsel ────────────────────────────────────────────── */

function BilahBawah({ path }: { path: string }) {
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const utama = NAV.filter((n) => n.utama);
  const lainnya = NAV.filter((n) => !n.utama);
  const adaLainnyaAktif = lainnya.some((n) => aktifkan(path, n.href));

  return (
    <>
      {menuTerbuka ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuTerbuka(false)}
            aria-label="Tutup menu"
          />
          <div className="absolute inset-x-0 bottom-0 border-t border-bordr-strong bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <span className="label-mikro text-ink-soft">Menu lainnya</span>
              <button
                onClick={() => setMenuTerbuka(false)}
                className="grid size-8 place-items-center text-ink-faint hover:bg-surface-2"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {lainnya.map(({ href, label, ikon: Ikon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuTerbuka(false)}
                    className={cn(
                      "flex items-center gap-2.5 border border-bordr px-3 py-3 text-[13px] transition",
                      aktifkan(path, href)
                        ? "border-aksen/40 bg-aksen-lembut text-aksen"
                        : "text-ink-soft hover:bg-surface-2",
                    )}
                  >
                    <Ikon size={17} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-bordr bg-surface/95 backdrop-blur-md lg:hidden"
        aria-label="Navigasi utama"
      >
        <ul className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
          {utama.map(({ href, labelPendek, ikon: Ikon }) => {
            const aktif = aktifkan(path, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 transition",
                    aktif ? "text-aksen" : "text-ink-faint",
                  )}
                >
                  <span
                    className={cn(
                      "h-[2px] w-8 transition-opacity",
                      aktif ? "bg-aksen-isi opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <Ikon size={18} strokeWidth={aktif ? 2.2 : 1.7} />
                  <span className="label-mikro text-[9px] text-current">{labelPendek}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMenuTerbuka(true)}
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2.5 transition",
                adaLainnyaAktif ? "text-aksen" : "text-ink-faint",
              )}
              aria-label="Menu lainnya"
            >
              <span
                className={cn(
                  "h-[2px] w-8 transition-opacity",
                  adaLainnyaAktif ? "bg-aksen-isi opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <MoreHorizontal size={18} />
              <span className="label-mikro text-[9px] text-current">Lainnya</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/* ── Bilah atas ─────────────────────────────────────────────────────── */

function BilahAtas({ path }: { path: string }) {
  const { mode, pengguna, keluar } = useData();
  const { menyegarkan, segarkanHarga, hargaTertua, posisiAktif } = usePortofolio();
  const daring = useDaring();

  return (
    <header className="sticky top-0 z-20 border-b border-bordr bg-canvas/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="lg:hidden" aria-label="Nakhoda, ke dasbor">
          <span className="grid size-9 place-items-center border border-aksen/40 bg-aksen-lembut text-aksen">
            <Logo size={17} />
          </span>
        </Link>

        <div className="min-w-0">
          {/* Baris mikro di atas judul. Bukan hiasan: dia yang menyebut app-nya,
              karena judul di bawahnya cuma menyebut halaman. Di rel samping
              nama app hanya muncul sebagai lambang. */}
          <p className="label-mikro">Nakhoda · pelacak portofolio</p>
          <h1 className="mt-0.5 truncate font-mono text-[15px] leading-none font-semibold tracking-tight text-ink uppercase">
            {judulHalaman(path)}
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!daring ? (
            <ChipStatus nada="peringatan" className="hidden sm:inline-flex">
              <CloudOff size={11} className="-ml-0.5" />
              Luring
            </ChipStatus>
          ) : (
            <ChipStatus nada="naik" denyut className="hidden sm:inline-flex">
              Langsung
            </ChipStatus>
          )}

          {mode === "lokal" ? (
            <ChipStatus
              nada="netral"
              className="hidden sm:inline-flex"
              title="Data disimpan di browser ini saja. Isi .env.local untuk menyalakan sinkronisasi Firebase."
            >
              <HardDrive size={11} className="-ml-0.5" />
              Lokal
            </ChipStatus>
          ) : null}

          {posisiAktif.length > 0 ? (
            <span className="angka hidden text-[10px] tracking-tight text-ink-faint md:inline">
              {hargaTertua ? `HARGA ${selangWaktu(hargaTertua).toUpperCase()}` : "HARGA BELUM DIAMBIL"}
            </span>
          ) : null}

          <Jam className="angka hidden text-[11px] text-ink-soft md:inline" />

          <button
            onClick={() => void segarkanHarga()}
            disabled={menyegarkan}
            className="grid size-9 place-items-center border border-transparent text-ink-soft transition hover:border-bordr hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            aria-label="Segarkan harga"
            title="Segarkan harga"
          >
            <RefreshCw size={15} className={menyegarkan ? "animate-spin" : undefined} />
          </button>

          <TombolTema ringkas />

          {mode === "firestore" && pengguna ? (
            <button
              onClick={() => void keluar()}
              className="grid size-9 place-items-center border border-transparent text-ink-soft transition hover:border-bordr hover:bg-surface-2 hover:text-ink"
              aria-label={`Keluar dari ${pengguna.email ?? "akun"}`}
              title="Keluar"
            >
              <LogOut size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* ── Kerangka ───────────────────────────────────────────────────────── */

export function Kerangka({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { mode, pengguna, siap } = useData();

  if (mode === "firestore" && !pengguna) {
    // Selama status auth belum diketahui, layar sengaja dibiarkan kosong dan
    // tenang. Menampilkan formulir masuk sekejap lalu menggantinya dengan
    // dasbor terasa seperti kesalahan, padahal sesi memang sudah ada.
    if (!siap) return <div className="min-h-dvh bg-canvas" />;
    return <LayarMasuk />;
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <RelSamping path={path} />
      <BilahBawah path={path} />
      <div className="lg:pl-[84px]">
        <BilahAtas path={path} />
        <main
          className={cn(
            "mx-auto w-full px-4 pt-5 pb-28 sm:px-6 lg:pb-10",
            // Chart butuh selebar-lebarnya; halaman lain lebih terbaca kalau
            // barisnya tidak melar sampai ujung layar lebar.
            path.startsWith("/chart") ? "max-w-none" : "max-w-[1400px]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
