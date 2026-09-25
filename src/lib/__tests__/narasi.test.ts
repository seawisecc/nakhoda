import { DAFTAR_SINYAL } from "@/lib/hitung/sinyal";
import type { HasilSinyal } from "@/lib/hitung/evaluasi-sinyal";
import {
  kalimatRentang, narasiSerupa, narasiSinyal, rentangHarga, sebaran, sebaranHariBiasa, tindakanPindai,
} from "@/lib/hitung/narasi";
import { ujiDariIndeks, type Penilaian } from "@/lib/hitung/uji-kejadian";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const naik = DAFTAR_SINYAL.find((d) => d.arah === "naik")!;
const turun = DAFTAR_SINYAL.find((d) => d.arah === "turun")!;

function tiruan(
  def = naik, nilai: Penilaian = { tingkat: "catatan", searah: true }, rr: number | null = 2, aktifDi: number | null = 9,
): HasilSinyal {
  const deret = Array.from({ length: 12 }, (_, i) => ({ tanggal: `d${i}`, tutup: 100 + i }));
  return {
    def, kejadian: [], uji: ujiDariIndeks(deret, [0, 1, 2, 3, 4, 5], 2), nilai, kalimat: "", aktifDi,
    level: rr === null ? null : { entry: 100, stop: 90, target: 100 + 10 * rr, rr },
  };
}
const ks = (dipegang = false) => ({ ticker: "MU", dipegang, horizon: 5, indeksAkhir: 10, satuan: "hari bursa" });

grup("narasi: sebaran dan rentang", () => {
  uji("kuartil 25, 50, 75 dengan interpolasi", () => {
    const s = sebaran([0.05, 0.01, 0.02, 0.04, 0.03])!;
    mendekati(s.bawah, 0.02, 1e-12);
    mendekati(s.tengah, 0.03, 1e-12);
    mendekati(s.atas, 0.04, 1e-12);
    samaDengan(s.n, 5);
  });

  uji("di bawah lima kejadian tidak ada sebaran", () => samaDengan(sebaran([0.1, 0.2, 0.3, 0.4]), null));

  uji("hari biasa memakai setiap titik awal", () => {
    const deret = [100, 110, 121, 133.1, 146.41, 161.051].map((t, i) => ({ tanggal: `d${i}`, tutup: t }));
    mendekati(sebaranHariBiasa(deret, 1)!.tengah, 0.1, 1e-9);
  });

  uji("rentang harga dari harga sekarang", () => {
    const r = rentangHarga({ bawah: -0.1, tengah: 0, atas: 0.2, n: 8 }, null, 50);
    samaDengan([r.bawah, r.tengah, r.atas, r.dari, r.n], [45, 50, 60, 50, 8]);
  });

  uji("rentang yang tidak lolos uji diberi peringatan bukan ramalan", () => {
    const r = rentangHarga({ bawah: -0.1, tengah: 0, atas: 0.2, n: 8 }, null, 50);
    benar(kalimatRentang(r, "acak", 5, "hari bursa", "MU").includes("bukan ramalan"));
    benar(!kalimatRentang(r, "catatan", 5, "hari bursa", "MU").includes("bukan ramalan"));
  });
});

grup("narasi: tindakan sinyal", () => {
  uji("lolos dan R:R cukup: sebut harga masuk, batal, dan target", () => {
    const t = narasiSinyal(tiruan(), ks()).tindakan;
    benar(t.startsWith("Layak dipertimbangkan untuk beli MU"), t);
    benar(t.includes("$90") && t.includes("$120"), t);
  });

  uji("tidak lolos: tidak perlu berbuat apa-apa", () => {
    const t = narasiSinyal(tiruan(naik, { tingkat: "acak", searah: null }), ks()).tindakan;
    benar(t.startsWith("Tidak perlu berbuat apa-apa"), t);
  });

  uji("posisi yang dipegang diingatkan ke rencana yang sudah ada", () => {
    benar(narasiSinyal(tiruan(naik, { tingkat: "lemah", searah: true }), ks(true)).tindakan.includes("batas rugi"));
  });

  uji("terbalik: jangan ikuti arahnya, dan kalimat percaya menyebut arah sebaliknya", () => {
    const n = narasiSinyal(tiruan(naik, { tingkat: "catatan", searah: false }), ks());
    benar(n.tindakan.startsWith("Jangan ikuti"));
    benar(n.percaya.startsWith("Justru sebaliknya"));
  });

  uji("tanda turun di saham yang tidak dipegang cuma berarti jangan beli", () =>
    benar(narasiSinyal(tiruan(turun), ks(false)).tindakan.includes("jangan beli dulu")));

  uji("R:R di bawah 1,5 dilewati walau polanya bisa dipercaya", () =>
    benar(narasiSinyal(tiruan(naik, undefined, 1.2), ks()).tindakan.includes("Lewati")));

  uji("umur tanda dibaca dari indeks terakhir", () => {
    benar(narasiSinyal(tiruan(naik, undefined, 2, 10), ks()).terlihat.includes("di sesi terakhir"));
    benar(narasiSinyal(tiruan(naik, undefined, 2, 8), ks()).terlihat.includes("2 sesi lalu"));
  });
});

grup("narasi: serupa dan pemindai", () => {
  uji("tanpa kecocokan tidak ada yang dinilai", () => {
    const n = narasiSerupa(null, null, {
      ticker: "MU", dipegang: false, horizon: 5, satuan: "hari", panjang: 20, paling: null, jumlah: 0,
    });
    samaDengan(n.percaya, "Tidak ada yang bisa dinilai.");
  });

  uji("pemindai: yang layak menyebut arah dan imbalannya", () => {
    const h = tiruan();
    benar(tindakanPindai({ aktif: [h], layak: [h] }, "MU").startsWith("Pertimbangkan beli"));
  });

  uji("pemindai: tidak ada yang layak berarti diam saja", () => {
    samaDengan(tindakanPindai({ aktif: [], layak: [] }, "MU"), "Diam saja. Tidak ada pola yang muncul.");
    benar(tindakanPindai({ aktif: [tiruan(naik, { tingkat: "acak", searah: null })], layak: [] }, "MU").startsWith("Diam saja."));
  });
});
