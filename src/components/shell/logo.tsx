import { cn } from "@/lib/cn";

/** Lambang Nakhoda: jangkar yang disederhanakan jadi tiga garis.
 *  Ditulis sebagai SVG sebaris, bukan file gambar, supaya ikut mewarisi warna
 *  teks dan tidak menambah satu permintaan jaringan hanya untuk 20 piksel. */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="4.4" r="2.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 6.6V21M7.4 9.4h9.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4 13.4c0 4.3 3.6 7.6 8 7.6s8-3.3 8-7.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Merek({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center border border-aksen/40 bg-aksen-lembut text-aksen">
        <Logo size={20} />
      </span>
      <span className="leading-tight">
        <span className="block font-mono text-[15px] font-semibold tracking-tight text-ink uppercase">Nakhoda</span>
        <span className="label-mikro mt-1 block">Kapten dari modalmu sendiri</span>
      </span>
    </div>
  );
}
