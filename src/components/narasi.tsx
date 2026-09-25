import type { Narasi } from "@/lib/hitung/narasi";
import { cn } from "@/lib/cn";

const BARIS = [
  ["terlihat", "Yang terlihat"],
  ["percaya", "Bisa dipercaya?"],
  ["tindakan", "Tindakan"],
] as const;

/** Tiga pertanyaan yang sama di setiap layar analisis: apa yang terlihat,
 *  apakah catatannya cukup, dan apa yang dilakukan. Urutannya tetap supaya
 *  mata tahu di baris mana jawabannya, di layar mana pun. */
export function BlokNarasi({
  narasi, perkiraan, className,
}: {
  narasi: Narasi;
  /** Kalimat rentang harga, kalau ada. */
  perkiraan?: string | null;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-2 text-[12.5px] leading-relaxed", className)}>
      {BARIS.map(([kunci, label]) => (
        <div key={kunci}>
          <dt className="label-mikro">{label}</dt>
          <dd className={cn("mt-0.5", kunci === "tindakan" ? "font-medium text-ink" : "text-ink-soft")}>
            {narasi[kunci]}
          </dd>
        </div>
      ))}
      {perkiraan ? (
        <div>
          <dt className="label-mikro">Perkiraan dari catatan</dt>
          <dd className="mt-0.5 text-ink-soft">{perkiraan}</dd>
        </div>
      ) : null}
    </dl>
  );
}
