"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPersen, formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { hitungTonggak } from "@/lib/hitung/tonggak";
import type { MataUang } from "@/types";

/* Warna seri diambil dari token, tidak pernah ditulis sebagai hex di sini.
 * Slot tetap: 1 saham, 2 kripto, 3 kas. Tidak pernah didaur ulang. */
export const SERI = ["var(--nk-seri-1)", "var(--nk-seri-2)", "var(--nk-seri-3)"] as const;

export interface Irisan {
  label: string;
  nilai: number;
  seri: 0 | 1 | 2;
}

/* ── Donat alokasi ──────────────────────────────────────────────────────
 *
 * Donat, bukan pie, karena lubang tengahnya dipakai untuk angka utama, dan
 * karena membandingkan panjang busur lebih mudah daripada membandingkan luas
 * juring. Jumlah irisan dibatasi tiga; di atas itu donat berhenti terbaca dan
 * daftar bernilai jauh lebih baik.
 *
 * Identitas irisan tidak pernah hanya lewat warna: setiap irisan punya baris
 * legenda dengan label dan nilainya, dan ada tabel angka di bawahnya.
 */
export function Donat({
  irisan, mataUang, judulTengah, nilaiTengah,
}: {
  irisan: Irisan[];
  mataUang: MataUang;
  judulTengah: string;
  nilaiTengah: string;
}) {
  const [aktif, setAktif] = useState<number | null>(null);
  const total = irisan.reduce((s, i) => s + Math.max(0, i.nilai), 0);
  const terpakai = irisan.filter((i) => i.nilai > 0);

  const R = 38;
  const KELILING = 2 * Math.PI * R;
  // Celah 1,6 unit di ruang viewBox jatuh sekitar 2px pada ukuran render
  // biasa. Celah inilah yang memisahkan dua irisan bersebelahan tanpa perlu
  // garis pembatas berwarna.
  const CELAH = terpakai.length > 1 ? 1.6 : 0;

  // Ditulis sebagai perulangan biasa, bukan map dengan penghitung di luar
  // callback: mengubah variabel yang tertangkap closure selama render adalah
  // pola yang bikin hasilnya bergantung pada berapa kali callback dijalankan.
  const busur: Array<Irisan & { porsi: number; panjang: number; mulai: number }> = [];
  for (let n = 0, jalan = 0; n < terpakai.length; n += 1) {
    const i = terpakai[n];
    const porsi = i.nilai / total;
    busur.push({
      ...i,
      porsi,
      panjang: Math.max(0, porsi * KELILING - CELAH),
      mulai: jalan,
    });
    jalan += porsi * KELILING;
  }

  const disorot = aktif !== null ? busur[aktif] : null;

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          role="img"
          aria-label={`Alokasi portofolio: ${busur
            .map((b) => `${b.label} ${formatPersen(b.porsi * 100, 1, false)}`)
            .join(", ")}`}
        >
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke="var(--nk-surface-sunk)"
            strokeWidth="13"
          />
          {busur.map((b, n) => (
            <circle
              key={b.label}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={SERI[b.seri]}
              strokeWidth={aktif === n ? 15 : 13}
              strokeDasharray={`${b.panjang} ${KELILING - b.panjang}`}
              strokeDashoffset={-b.mulai}
              strokeLinecap="butt"
              className="cursor-pointer transition-[stroke-width] duration-150"
              onMouseEnter={() => setAktif(n)}
              onMouseLeave={() => setAktif(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="label-mikro">
            {disorot ? disorot.label : judulTengah}
          </span>
          <span className="angka mt-0.5 text-[17px] leading-tight font-semibold text-ink">
            {disorot ? formatUang(disorot.nilai, mataUang, { ringkas: true }) : nilaiTengah}
          </span>
          {disorot ? (
            <span className="angka mt-0.5 text-[12px] text-ink-soft">
              {formatPersen(disorot.porsi * 100, 1, false)}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {irisan.map((i) => {
          const porsi = total > 0 ? i.nilai / total : 0;
          const indeksBusur = busur.findIndex((b) => b.label === i.label);
          return (
            <li
              key={i.label}
              className={cn(
                "flex items-center gap-2.5 px-1.5 py-1 transition-colors",
                aktif === indeksBusur && indeksBusur >= 0 && "bg-surface-2",
              )}
              onMouseEnter={() => indeksBusur >= 0 && setAktif(indeksBusur)}
              onMouseLeave={() => setAktif(null)}
            >
              <span
                className="size-2.5 shrink-0"
                style={{ background: SERI[i.seri] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{i.label}</span>
              <span className="angka text-[13px] text-ink-faint">
                {formatPersen(porsi * 100, 1, false)}
              </span>
              <span className="angka w-24 text-right text-[13px] font-medium text-ink">
                {formatUang(i.nilai, mataUang, { ringkas: true })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Grafik area nilai portofolio ───────────────────────────────────────
 *
 * Satu seri, jadi tidak ada legenda: judul kartunya sudah menyebut apa yang
 * digambar. Sumbu tunggal, selalu. Dua ukuran berbeda skala tidak pernah
 * ditumpuk di satu grafik dengan dua sumbu Y.
 */
export interface TitikArea {
  tanggal: string;
  nilai: number;
}

export function Area({
  titik, mataUang, tinggi = 180, mengisi = false,
}: {
  titik: TitikArea[];
  mataUang: MataUang;
  tinggi?: number;
  /** Mengisi tinggi induknya alih-alih memakai `tinggi`. Dipakai saat grafik
   *  duduk di panel yang tingginya ditentukan panel tetangganya di grid; tanpa
   *  ini, tinggi grafik harus ditebak angka yang kebetulan cocok, dan tebakan
   *  itu langsung meleset begitu isi panel sebelah berubah. */
  mengisi?: boolean;
}) {
  const gradienId = useId();
  const [sorot, setSorot] = useState<number | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  const L = 640;
  const T = 200;
  const PAD_ATAS = 14;
  const PAD_BAWAH = 22;

  const geo = useMemo(() => {
    if (titik.length < 2) return null;
    const nilai = titik.map((t) => t.nilai);
    const min = Math.min(...nilai);
    const maks = Math.max(...nilai);
    // Rentang dipadatkan 8% di atas dan bawah supaya garis tidak menempel di
    // tepi. Kalau seluruh nilai sama, rentang dibuat buatan agar garis jatuh
    // di tengah, bukan menghasilkan pembagian nol.
    const rentang = maks - min || Math.abs(maks) * 0.1 || 1;
    const bawah = min - rentang * 0.08;
    const atas = maks + rentang * 0.08;
    const x = (n: number) => (n / (titik.length - 1)) * L;
    const y = (v: number) => PAD_ATAS + (1 - (v - bawah) / (atas - bawah)) * (T - PAD_ATAS - PAD_BAWAH);
    const koord = titik.map((t, n) => ({ x: x(n), y: y(t.nilai) }));
    const garis = koord.map((k, n) => `${n ? "L" : "M"}${k.x.toFixed(2)},${k.y.toFixed(2)}`).join(" ");
    return {
      koord, garis, min, maks,
      isi: `${garis} L${L},${T - PAD_BAWAH + 6} L0,${T - PAD_BAWAH + 6} Z`,
      naik: titik[titik.length - 1].nilai >= titik[0].nilai,
    };
  }, [titik]);

  if (!geo) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-dashed border-bordr text-[12px] text-ink-faint",
          mengisi && "h-full",
        )}
        style={mengisi ? undefined : { height: tinggi }}
      >
        Butuh minimal dua hari data untuk menggambar grafik.
      </div>
    );
  }

  const warna = geo.naik ? "var(--nk-naik)" : "var(--nk-turun)";
  const t = sorot !== null ? titik[sorot] : null;
  const k = sorot !== null ? geo.koord[sorot] : null;

  function gerak(e: React.MouseEvent<HTMLDivElement>) {
    const kotak = wadah.current?.getBoundingClientRect();
    if (!kotak || kotak.width === 0) return;
    const rasio = (e.clientX - kotak.left) / kotak.width;
    setSorot(Math.max(0, Math.min(titik.length - 1, Math.round(rasio * (titik.length - 1)))));
  }

  return (
    <div
      ref={wadah}
      className={cn("relative", mengisi && "h-full")}
      style={mengisi ? undefined : { height: tinggi }}
      onMouseMove={gerak}
      onMouseLeave={() => setSorot(null)}
    >
      <svg
        viewBox={`0 0 ${L} ${T}`}
        preserveAspectRatio="none"
        className="size-full"
        role="img"
        aria-label={`Nilai portofolio dari ${formatTanggal(titik[0].tanggal)} sampai ${formatTanggal(
          titik[titik.length - 1].tanggal,
        )}, dari ${formatUang(titik[0].nilai, mataUang)} ke ${formatUang(
          titik[titik.length - 1].nilai, mataUang,
        )}`}
      >
        <defs>
          <linearGradient id={gradienId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={warna} stopOpacity="0.22" />
            <stop offset="100%" stopColor={warna} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0" x2={L}
            y1={PAD_ATAS + f * (T - PAD_ATAS - PAD_BAWAH)}
            y2={PAD_ATAS + f * (T - PAD_ATAS - PAD_BAWAH)}
            stroke="var(--nk-grid)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={geo.isi} fill={`url(#${gradienId})`} />
        <path
          d={geo.garis}
          fill="none"
          stroke={warna}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {k ? (
          <>
            <line
              x1={k.x} x2={k.x} y1={PAD_ATAS - 6} y2={T - PAD_BAWAH + 6}
              stroke="var(--nk-border-strong)" strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={k.x} cy={k.y} r="4.5"
              fill={warna}
              stroke="var(--nk-surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>

      {t && k ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 border border-bordr-strong bg-surface px-2.5 py-1.5 shadow-e2"
          style={{ left: `${Math.min(88, Math.max(12, (k.x / L) * 100))}%` }}
        >
          <div className="label-mikro whitespace-nowrap">
            {formatTanggal(t.tanggal)}
          </div>
          <div className="angka text-[13px] font-semibold whitespace-nowrap text-ink">
            {formatUang(t.nilai, mataUang)}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>{formatTanggal(titik[0].tanggal)}</span>
        <span>{formatTanggal(titik[titik.length - 1].tanggal)}</span>
      </div>
    </div>
  );
}

/* ── Meter target bulanan ───────────────────────────────────────────────
 *
 * Bukan chart, melainkan satu ukuran tunggal terhadap rentang target. Yang
 * digambar adalah pita target 3-10% sebagai latar, dan capaian sebagai batang
 * di atasnya, supaya "sudah sampai mana" terbaca dalam sekali lihat tanpa
 * membaca angka.
 */
export function MeterTarget({
  nilai, min, maks,
}: {
  nilai: number | null;
  min: number;
  maks: number;
}) {
  // Skala dibuat sedikit lebih lebar dari target supaya batang yang melewati
  // target masih punya ruang untuk tumbuh, dan return negatif tetap terlihat.
  const batasAtas = Math.max(maks * 1.4, nilai ?? 0, maks + 1);
  const batasBawah = Math.min(0, (nilai ?? 0) * 1.2);
  const rentang = batasAtas - batasBawah || 1;
  const ke = (v: number) => ((v - batasBawah) / rentang) * 100;

  const nol = ke(0);
  const capaian = nilai === null ? null : ke(nilai);
  const negatif = (nilai ?? 0) < 0;
  const warna =
    nilai === null ? "var(--nk-netral)"
      : nilai < 0 ? "var(--nk-turun)"
        : nilai >= min ? "var(--nk-naik)"
          : "var(--nk-peringatan)";

  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden border border-bordr bg-surface-sunk">
        <div
          className="absolute inset-y-0 bg-naik/18"
          style={{ left: `${ke(min)}%`, width: `${ke(maks) - ke(min)}%` }}
          aria-hidden
        />
        {capaian !== null ? (
          <div
            className="absolute inset-y-0 transition-[left,width] duration-500"
            style={{
              left: `${negatif ? capaian : nol}%`,
              width: `${Math.max(0.8, Math.abs(capaian - nol))}%`,
              background: warna,
            }}
          />
        ) : null}
        <div
          className="absolute inset-y-0 w-px bg-bordr-strong"
          style={{ left: `${nol}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
        <span className="angka">{formatPersen(batasBawah, 0, false)}</span>
        <span className="angka text-naik">
          target {formatPersen(min, 0, false)} sampai {formatPersen(maks, 0, false)}
        </span>
        <span className="angka">{formatPersen(batasAtas, 0, false)}</span>
      </div>
    </div>
  );
}

/* ── Meter menuju target kekayaan ───────────────────────────────────────
 *
 * Yang diukur batangnya adalah jarak ke tonggak berikutnya, bukan ke target
 * akhir. Rp 8 juta menuju Rp 1 miliar itu 0,8%, dan batang 0,8% terlihat
 * kosong hari ini, kosong bulan depan, kosong tahun depan. Batang yang tidak
 * pernah bergerak berhenti dibaca sebagai informasi, dan lebih buruk lagi,
 * membuat kemajuan yang nyata terasa seperti bukan apa-apa.
 *
 * Target akhirnya tidak disembunyikan, cuma dipindahkan ke baris konteks. Dua
 * angka, dua-duanya jujur: satu yang bergerak tiap minggu, satu yang
 * mengingatkan sedang menuju ke mana.
 */

export function MeterKekayaan({
  nilai, target, mataUang,
}: {
  nilai: number;
  target: number;
  mataUang: MataUang;
}) {
  const t = hitungTonggak(nilai, target);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="angka text-[13px] font-semibold text-[var(--utama-teks)]">
          {t.selesai
            ? "Target tercapai"
            : `${formatPersen(t.porsi * 100, t.porsi < 0.1 ? 1 : 0, false)} menuju ${formatUang(
                t.atas, mataUang, { ringkas: true },
              )}`}
        </span>
        <span className="angka text-[12px] text-[var(--utama-teks-faint)]">
          {formatPersen(t.porsiTarget * 100, t.porsiTarget < 0.1 ? 2 : 1, false)} dari{" "}
          {formatUang(target, mataUang, { ringkas: true })}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden border border-bordr bg-surface-sunk">
        <div
          className="h-full transition-[width] duration-700"
          style={{
            width: `${Math.max(t.porsi * 100, nilai > 0 ? 2 : 0)}%`,
            // Batang kemajuan sengaja netral, bukan hijau dan bukan merah: kemajuan
            // menuju target bukan untung, dan bukan rugi.
            background: "var(--nk-ink)",
          }}
        />
        {[0.25, 0.5, 0.75].map((f) => (
          <span
            key={f}
            className="absolute inset-y-0 w-px bg-[var(--utama-garis)]"
            style={{ left: `${f * 100}%` }}
            aria-hidden
          />
        ))}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="angka text-[12px] text-[var(--utama-teks-faint)]">
          {formatUang(t.bawah, mataUang, { ringkas: true })}
        </span>
        <span className="angka text-[12px] text-[var(--utama-teks-faint)]">
          {formatUang(t.atas, mataUang, { ringkas: true })}
        </span>
      </div>
    </div>
  );
}

/* ── Garis mini ────────────────────────────────────────────────────────
 *  Dipakai di baris tabel. Tanpa sumbu, tanpa label: tugasnya cuma menunjukkan
 *  bentuk, bukan nilai. */
export function GarisMini({ nilai, className }: { nilai: number[]; className?: string }) {
  if (nilai.length < 2) return null;
  const min = Math.min(...nilai);
  const maks = Math.max(...nilai);
  const rentang = maks - min || 1;
  const d = nilai
    .map((v, n) => `${n ? "L" : "M"}${(n / (nilai.length - 1)) * 60},${(1 - (v - min) / rentang) * 18 + 1}`)
    .join(" ");
  const naik = nilai[nilai.length - 1] >= nilai[0];
  return (
    <svg viewBox="0 0 60 20" className={cn("h-5 w-15", className)} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={naik ? "var(--nk-naik)" : "var(--nk-turun)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
