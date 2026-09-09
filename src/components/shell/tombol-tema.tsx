"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTema, type PilihanTema } from "@/lib/tema";

const OPSI: { nilai: PilihanTema; label: string; Ikon: typeof Sun }[] = [
  { nilai: "gelap", label: "Gelap", Ikon: Moon },
  { nilai: "terang", label: "Terang", Ikon: Sun },
  { nilai: "sistem", label: "Ikut sistem", Ikon: Monitor },
];

/** Tiga pilihan, bukan sakelar dua arah.
 *  Sakelar dua arah memaksa pengguna memilih satu tema selamanya; opsi
 *  "ikut sistem" membiarkan app gelap di malam hari dan terang di siang hari
 *  tanpa disentuh. */
export function TombolTema({ ringkas = false }: { ringkas?: boolean }) {
  const { pilihan, setTema } = useTema();

  if (ringkas) {
    const sekarang = OPSI.findIndex((o) => o.nilai === pilihan);
    const berikut = OPSI[(sekarang + 1) % OPSI.length];
    const { Ikon } = OPSI[sekarang === -1 ? 0 : sekarang];
    return (
      <button
        onClick={() => setTema(berikut.nilai)}
        className="grid size-9 place-items-center border border-transparent text-ink-soft transition hover:border-bordr hover:bg-surface-2 hover:text-ink"
        title={`Tema: ${OPSI[sekarang === -1 ? 0 : sekarang].label}. Klik untuk ${berikut.label.toLowerCase()}.`}
        aria-label={`Ganti tema, sekarang ${OPSI[sekarang === -1 ? 0 : sekarang].label}`}
      >
        <Ikon size={17} />
      </button>
    );
  }

  return (
    <div
      className="inline-flex border border-bordr-strong bg-surface-sunk p-1"
      role="radiogroup"
      aria-label="Tema tampilan"
    >
      {OPSI.map(({ nilai, label, Ikon }) => (
        <button
          key={nilai}
          role="radio"
          aria-checked={pilihan === nilai}
          onClick={() => setTema(nilai)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition",
            pilihan === nilai
              ? "bg-surface text-ink"
              : "text-ink-faint hover:text-ink-soft",
          )}
        >
          <Ikon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
