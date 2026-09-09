"use client";

import { useMemo } from "react";
import type { Alokasi } from "@/types";
import { formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { Kartu, JudulKartu, Lencana } from "@/components/ui/dasar";

/** Rencana belanja kas terbaru.
 *
 *  Diletakkan di atas daftar saran, bukan di bawahnya, karena urutan membacanya
 *  memang begitu: berapa yang boleh dibelanjakan dulu, baru dibelanjakan ke
 *  mana. Dibalik, tiap saran akan terbaca seolah berdiri sendiri dan ukuran
 *  posisinya ditentukan belakangan oleh sisa kas, yang persis cara portofolio
 *  kecil jadi terkonsentrasi tanpa pernah ada keputusan untuk itu.
 *
 *  Hanya yang terbaru yang ditampilkan. Rencana alokasi basi bukan cuma tidak
 *  berguna, dia menyesatkan: angkanya dihitung dari kas yang sudah tidak
 *  segitu lagi. */
export function PanelAlokasi({ daftar }: { daftar: readonly Alokasi[] }) {
  const terbaru = useMemo(
    () =>
      [...daftar].sort(
        (a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0),
      )[0],
    [daftar],
  );

  if (!terbaru) return null;

  const totalPos = terbaru.pos.reduce((s, p) => s + p.jumlah, 0);

  return (
    <Kartu>
      <JudulKartu
        judul="Rencana belanja kas"
        keterangan="Pendapat soal ukuran, bukan hipotesis soal arah. Tidak ikut dihitung di win rate."
        aksi={<span className="label-mikro">{formatTanggal(terbaru.tanggal)}</span>}
      />

      <p className="text-[13px] leading-relaxed text-ink-soft">{terbaru.ringkasan}</p>

      {terbaru.pos.length ? (
        <div className="mt-4 -mx-4 -mb-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-bordr">
                <th scope="col" className="label-mikro px-4 py-2 text-left">Pos</th>
                <th scope="col" className="label-mikro px-4 py-2 text-right">Jumlah</th>
                <th scope="col" className="label-mikro px-4 py-2 text-left">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {terbaru.pos.map((p) => (
                <tr key={p.label} className="border-b border-bordr">
                  <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-ink">
                    {p.label}
                  </td>
                  <td className="angka px-4 py-2.5 text-right whitespace-nowrap text-ink">
                    {formatUang(p.jumlah, terbaru.mataUang, { ringkas: true })}
                  </td>
                  <td className="px-4 py-2.5 leading-relaxed text-ink-soft">{p.alasan ?? "—"}</td>
                </tr>
              ))}

              {terbaru.kasDitahan !== undefined ? (
                <tr className="border-b border-bordr bg-surface-sunk">
                  <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-ink-soft">
                    Kas ditahan
                  </td>
                  <td className="angka px-4 py-2.5 text-right whitespace-nowrap text-ink-soft">
                    {formatUang(terbaru.kasDitahan, terbaru.mataUang, { ringkas: true })}
                  </td>
                  <td className="px-4 py-2.5 leading-relaxed text-ink-faint">
                    {terbaru.totalSaatItu
                      ? `${((terbaru.kasDitahan / terbaru.totalSaatItu) * 100).toFixed(0)}% dari porto saat rencana ini dibuat`
                      : "sengaja tidak dibelanjakan"}
                  </td>
                </tr>
              ) : null}

              <tr>
                <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-ink">Dibelanjakan</td>
                <td className="angka px-4 py-2.5 text-right whitespace-nowrap font-medium text-ink">
                  {formatUang(totalPos, terbaru.mataUang, { ringkas: true })}
                </td>
                <td className="px-4 py-2.5 text-ink-faint">
                  {/* Total portofolio ikut disimpan supaya rupiah di atas masih
                      bisa dibaca proporsinya berbulan-bulan kemudian, saat
                      portofolionya sudah bukan sebesar ini lagi. */}
                  {terbaru.totalSaatItu
                    ? `porto saat itu ${formatUang(terbaru.totalSaatItu, terbaru.mataUang, { ringkas: true })}`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <Lencana nada="peringatan">tidak membeli apa pun</Lencana>
        </div>
      )}
    </Kartu>
  );
}
