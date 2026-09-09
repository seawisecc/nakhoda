import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PenyediaTema, SKRIP_TEMA } from "@/lib/tema";
import { PenyediaData } from "@/lib/data/penyedia";
import { Kerangka } from "@/components/shell/kerangka";
import { DaftarSW } from "@/components/shell/daftar-sw";

/** Doto, font dot-matrix, dipakai HANYA untuk angka sorot (lihat .angka-sorot
 *  di globals.css). Di-host sendiri, bukan lewat next/font/google, supaya build
 *  tidak perlu jaringan; berkasnya subset latin, 5 KB.
 *
 *  Rentang bobotnya variabel 100-900 dan itu yang dipakai: pada dot-matrix,
 *  bobot menentukan besar titiknya, bukan tebal goresnya, jadi satu berkas
 *  bisa melayani angka besar yang rapat maupun angka sedang yang perlu titik
 *  lebih kecil. */
const doto = localFont({
  src: "./fonts/doto-latin-var.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-dot",
  // Kalau berkasnya gagal dimuat, angkanya jatuh ke mono biasa dan tetap
  // terbaca. Angka uang tidak boleh pernah hilang cuma karena font.
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Nakhoda | Portofolio",
  description:
    "Pelacak portofolio pribadi untuk saham AS dan kripto: posisi, P&L, jurnal trading, dan progres terhadap target bulanan.",
  applicationName: "Nakhoda",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nakhoda", statusBarStyle: "black-translucent" },
  // Dua sumber lambang: ikon-kecil.svg untuk ukuran tab, ikon.svg untuk
  // ukuran besar. Pada 16px gores ikon.svg tinggal 0,94px dan hilang ke
  // antialiasing, jadi tab butuh varian yang goresnya lebih tebal.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48 32x32 16x16" },
      { url: "/ikon-kecil.svg", type: "image/svg+xml" },
      { url: "/ikon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/ikon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/ikon-180.png",
  },
  // Data finansial pribadi tidak punya alasan untuk muncul di hasil pencarian.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a09" },
    { media: "(prefers-color-scheme: light)", color: "#e7e4dc" },
  ],
};

export default function TataLetakAkar({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={doto.variable} suppressHydrationWarning>
      <head>
        {/* Berjalan sebelum React merender, supaya tidak ada kedipan putih
            sebelum tema gelap terpasang. */}
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body>
        <PenyediaTema>
          <PenyediaData>
            <Kerangka>{children}</Kerangka>
          </PenyediaData>
        </PenyediaTema>
        <DaftarSW />
      </body>
    </html>
  );
}
