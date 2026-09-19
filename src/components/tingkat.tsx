import { Lencana } from "@/components/ui/dasar";
import { NAMA_TINGKAT, type Tingkat } from "@/lib/hitung/uji-kejadian";

/* Nada lencana per tingkat. "Punya catatan" memakai info, bukan naik atau
   aksen: dia menyatakan ada pola yang teruji, bukan bahwa harganya akan naik,
   dan pola turun yang punya catatan sama sahnya. */
const NADA = { catatan: "info", lemah: "peringatan", acak: "netral", jarang: "netral" } as const;

/** `searah` false berarti simpangannya berlawanan dengan klaim pola. Itu
 *  ditulis di lencananya sendiri: "Petunjuk lemah" saja di samping bullish
 *  engulfing yang diikuti penurunan akan terbaca sebagai petunjuk naik. */
export function LencanaTingkat({ tingkat, searah }: { tingkat: Tingkat; searah?: boolean | null }) {
  return (
    <Lencana nada={NADA[tingkat]}>
      {NAMA_TINGKAT[tingkat]}{searah === false ? ", terbalik" : ""}
    </Lencana>
  );
}
