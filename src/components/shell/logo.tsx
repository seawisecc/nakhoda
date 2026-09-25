import { cn } from "@/lib/cn";

/** Lambang Nakhoda: jangkar dari gores lurus berujung persegi.
 *  Geometrinya sama dengan public/ikon.svg supaya lambang di app dan di tab
 *  terbaca sebagai satu benda. Ujung persegi dan cincin kotak, bukan bulat,
 *  karena seluruh kerangka memakai sudut nol; jangkar melengkung dulu terbaca
 *  sebagai sisa sistem lama.
 *  Ditulis sebagai SVG sebaris, bukan file gambar, supaya ikut mewarisi warna
 *  teks dan tidak menambah satu permintaan jaringan hanya untuk 20 piksel. */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden
    >
      <rect x="9.5" y="2" width="5" height="5" />
      <path d="M12 7V21M7 10.5H17" />
      <path d="M4 13.5V16L12 21L20 16V13.5" />
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
