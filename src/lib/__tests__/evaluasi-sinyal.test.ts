import { DAFTAR_SINYAL, type Lilin } from "@/lib/hitung/sinyal";
import {
  JENDELA_AKTIF, evaluasiSinyal, hasilPerTanggal, layakSaran, ringkasPindai, type HasilSinyal,
} from "@/lib/hitung/evaluasi-sinyal";
import { ujiDariIndeks } from "@/lib/hitung/uji-kejadian";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

/** Jalan acak yang bisa diulang. */
function acak(n: number, benih = 3): Lilin[] {
  let x = benih;
  let h = 100;
  return Array.from({ length: n }, (_, i) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    h *= 1 + (x / 2147483648 - 0.5) * 0.05;
    return { tanggal: `t${String(i).padStart(4, "0")}`, buka: h, tinggi: h * 1.01, rendah: h * 0.99, tutup: h };
  });
}

/** HasilSinyal tiruan untuk menguji aturan kelayakan tanpa data harga. */
function tiruan(arah: "naik" | "turun", rr: number | null, aktif = true): HasilSinyal {
  const def = DAFTAR_SINYAL.find((d) => d.arah === arah)!;
  return {
    def,
    kejadian: [],
    uji: ujiDariIndeks([], [], 5),
    nilai: { tingkat: "catatan", searah: true },
    kalimat: "",
    aktifDi: aktif ? 0 : null,
    level: rr === null ? null : { entry: 100, stop: 90, target: 100 + 10 * rr, rr },
  };
}

grup("evaluasi sinyal", () => {
  uji("satu hasil untuk setiap sinyal di daftar", () => {
    samaDengan(evaluasiSinyal(acak(400), 5, "X").length, DAFTAR_SINYAL.length);
  });

  uji("deteksi dari luar memberi hasil yang sama dengan deteksi sendiri", () => {
    const b = acak(600);
    const deteksi = DAFTAR_SINYAL.map((d) => d.deteksi(b));
    const a = evaluasiSinyal(b, 10, "X");
    const c = evaluasiSinyal(b, 10, "X", deteksi);
    samaDengan(a.map((h) => [h.aktifDi, h.uji.kejadian.length]), c.map((h) => [h.aktifDi, h.uji.kejadian.length]));
  });

  uji(`aktif hanya kalau muncul di ${JENDELA_AKTIF} sesi terakhir`, () => {
    const b = acak(1500, 9);
    for (const h of evaluasiSinyal(b, 5, "X")) {
      if (h.aktifDi !== null) benar(h.aktifDi >= b.length - JENDELA_AKTIF, h.def.id);
    }
  });

  uji("level cuma ada untuk tanda aktif yang lolos koreksi dan searah", () => {
    for (const h of evaluasiSinyal(acak(1500, 5), 5, "X")) {
      if (h.level) benar(h.aktifDi !== null && h.nilai.tingkat === "catatan" && h.nilai.searah === true, h.def.id);
    }
  });
});

grup("kelayakan saran dan pemindai", () => {
  uji("tanpa level tidak layak", () => benar(!layakSaran(tiruan("naik", null), true)));
  uji("R:R di bawah 1,5 tidak layak", () => benar(!layakSaran(tiruan("naik", 1.49), true)));
  uji("tanda naik layak walau tidak dipegang", () => benar(layakSaran(tiruan("naik", 2), false)));
  uji("tanda turun cuma layak untuk yang dipegang", () => {
    benar(!layakSaran(tiruan("turun", 2), false));
    benar(layakSaran(tiruan("turun", 2), true));
  });

  uji("ringkasan memisahkan yang muncul dari yang layak", () => {
    const r = ringkasPindai([tiruan("naik", 2), tiruan("naik", 1.2), tiruan("naik", 3, false)], true);
    samaDengan(r.aktif.length, 2);
    samaDengan(r.layak.length, 1);
  });

  uji("hasil per tanggal tidak memuat kejadian yang jendelanya belum selesai", () => {
    const deret = [100, 110, 121, 133.1, 140].map((t, i) => ({ tanggal: `d${i}`, tutup: t }));
    const peta = hasilPerTanggal(ujiDariIndeks(deret, [1, 3], 2));
    mendekati(peta.get("d1")!, 0.21, 1e-9);
    samaDengan(peta.has("d3"), false);
  });
});
