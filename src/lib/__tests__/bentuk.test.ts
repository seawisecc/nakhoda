import {
  DAFTAR_SINYAL, daftarPivot, garisTren, hargaGaris, levelMendatar,
  polaGandaTerbentuk, type Lilin,
} from "@/lib/hitung/sinyal";
import { cariBentuk } from "@/lib/hitung/bentuk";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

let hari = 0;
const l = (tinggi: number, rendah: number, tutup = (tinggi + rendah) / 2): Lilin => ({
  tanggal: `b${String(hari++).padStart(4, "0")}`,
  buka: tutup, tinggi, rendah, tutup,
});
/** Deret zigzag: n gelombang, dasar naik `naikDasar` dan puncak naik
 *  `naikPuncak` tiap gelombang, satu gelombang 20 sesi.
 *
 *  Titik ekstremnya dibuat tunggal, bukan dua lilin bernilai sama: dua dasar
 *  bernilai persis sama membuat "dasar yang makin tinggi" gagal, dan itu
 *  benar menurut definisinya, cuma bukan yang mau diuji di sini. */
function zigzag(n: number, dasar0: number, puncak0: number, naikDasar: number, naikPuncak: number): Lilin[] {
  const tonggak: { i: number; h: number }[] = [];
  for (let g = 0; g < n; g += 1) {
    tonggak.push({ i: g * 20, h: dasar0 + g * naikDasar });
    tonggak.push({ i: g * 20 + 10, h: puncak0 + g * naikPuncak });
  }
  tonggak.push({ i: n * 20, h: dasar0 + n * naikDasar });

  const b: Lilin[] = [];
  for (let k = 1; k < tonggak.length; k += 1) {
    const a = tonggak[k - 1];
    const z = tonggak[k];
    for (let i = a.i; i < z.i; i += 1) {
      const h = a.h + ((z.h - a.h) * (i - a.i)) / (z.i - a.i);
      b.push(l(h + 0.2, h - 0.2, h));
    }
  }
  const akhir = tonggak[tonggak.length - 1];
  b.push(l(akhir.h + 0.2, akhir.h - 0.2, akhir.h));
  return b;
}

grup("garis tren", () => {
  uji("dasar yang makin tinggi menghasilkan garis tren naik", () => {
    const b = zigzag(5, 100, 120, 5, 5);
    const g = garisTren(b, b.length - 1, "naik", daftarPivot(b, "naik"))!;
    benar(g !== null, "garis harus ketemu");
    benar(g.hargaSampai > g.hargaDari, "garis harus menanjak");
    benar(g.sentuh >= 2, `sentuh ${g.sentuh}`);
  });

  uji("harga di garis dihitung lurus antara dua pivotnya", () => {
    const g = { dari: 0, sampai: 10, hargaDari: 100, hargaSampai: 110, sentuh: 3 };
    mendekati(hargaGaris(g, 5), 105, 1e-9);
    mendekati(hargaGaris(g, 20), 120, 1e-9);
  });

  uji("dasar yang tidak searah tidak menghasilkan garis", () => {
    // Dasar naik lalu turun: bukan tren.
    const b = [...zigzag(3, 100, 120, 6, 6), ...zigzag(3, 112, 132, -6, -6)];
    samaDengan(garisTren(b, b.length - 1, "naik", daftarPivot(b, "naik")), null);
  });

  uji("pivot yang belum terkonfirmasi tidak dipakai", () => {
    // Pivot butuh lima sesi di kanannya. Di lilin tepat pada dasar terakhir,
    // dasar itu belum boleh ikut membentuk garis.
    const b = zigzag(5, 100, 120, 5, 5);
    const p = daftarPivot(b, "naik");
    const akhir = p[p.length - 1];
    const g = garisTren(b, akhir, "naik", p)!;
    benar(g === null || g.sampai < akhir, "pivot terakhir belum boleh dipakai");
  });
});

grup("level mendatar", () => {
  uji("tiga puncak di harga yang sama jadi resisten", () => {
    const b = zigzag(5, 100, 140, 4, 0);
    const lv = levelMendatar(b, b.length - 1, "turun", daftarPivot(b, "turun"))!;
    benar(lv !== null, "level harus ketemu");
    mendekati(lv.harga, 140.2, 0.5);
    benar(lv.titik.length >= 3, `titik ${lv.titik.length}`);
  });

  uji("level yang sudah dilewati harga tidak dilaporkan sebagai resisten", () => {
    const b = [...zigzag(5, 100, 140, 4, 0), ...Array.from({ length: 6 }, () => l(160.2, 159.8, 160))];
    const lv = levelMendatar(b, b.length - 1, "turun", daftarPivot(b, "turun"));
    benar(lv === null || lv.harga > 160, "resisten harus di atas harga sekarang");
  });

  uji("puncak yang tersebar tidak membentuk level", () => {
    const b = zigzag(5, 100, 120, 5, 12);
    samaDengan(levelMendatar(b, b.length - 1, "turun", daftarPivot(b, "turun")), null);
  });
});

grup("pola ganda yang sedang terbentuk", () => {
  const w = (): Lilin[] => {
    const harga = [
      ...Array.from({ length: 12 }, (_, i) => 100 - i),
      ...Array.from({ length: 11 }, (_, i) => 89 + i),
      100, 99.5,
      ...Array.from({ length: 9 }, (_, i) => 99 - i),
      90,
      ...Array.from({ length: 6 }, (_, i) => 91 + i),
    ];
    return harga.map((h) => l(h + 0.3, h - 0.3, h));
  };

  uji("kaki lengkap tapi leher belum tembus: sedang terbentuk", () => {
    const b = w();
    const p = polaGandaTerbentuk(b, b.length - 1, "naik")!;
    benar(p !== null, "pola harus ketemu");
    mendekati(p.leher, 100.3, 1e-9);
  });

  uji("begitu lehernya tembus, dia bukan lagi 'sedang terbentuk'", () => {
    const b = [...w(), l(101, 100, 100.8), l(102, 101, 101.5)];
    samaDengan(polaGandaTerbentuk(b, b.length - 1, "naik"), null);
  });
});

grup("bentuk di chart", () => {
  uji("tren naik yang bersih menghasilkan garis tren naik dengan pemicu di bawah harga", () => {
    const b = zigzag(6, 100, 120, 5, 5);
    const bentuk = cariBentuk(b);
    const tren = bentuk.find((x) => x.id === "tren-naik")!;
    benar(tren !== undefined, "harus ada garis tren naik");
    samaDengan(tren.pemicu!.arah, "turun");
    benar(tren.pemicu!.harga < b[b.length - 1].tutup, "penyangga ada di bawah harga");
    samaDengan(tren.sinyalUji, "jebol-tren-naik");
  });

  uji("setiap sinyalUji menunjuk sinyal yang benar-benar ada", () => {
    const b = zigzag(6, 100, 140, 4, 0);
    for (const x of cariBentuk(b)) {
      if (!x.sinyalUji) continue;
      benar(DAFTAR_SINYAL.some((d) => d.id === x.sinyalUji), `sinyal ${x.sinyalUji} tidak ada`);
    }
  });

  uji("garis bentuk selalu punya minimal dua titik dan tanggalnya urut", () => {
    const b = zigzag(6, 100, 140, 4, 0);
    for (const x of cariBentuk(b)) {
      for (const g of x.garis) {
        benar(g.titik.length >= 2, `${x.id} punya garis satu titik`);
        for (let i = 1; i < g.titik.length; i += 1) {
          benar(g.titik[i].tanggal > g.titik[i - 1].tanggal, `${x.id} tanggalnya tidak urut`);
        }
      }
    }
  });

  uji("data terlalu pendek tidak menghasilkan bentuk apa pun", () =>
    samaDengan(cariBentuk(zigzag(1, 100, 110, 0, 0)).length, 0));
});
