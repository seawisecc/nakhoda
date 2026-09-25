import {
  DAFTAR_SINYAL, bollinger, ema, kejadianSinyal, levelSinyal, macd, polaGanda, rsi, sma, type Lilin,
} from "@/lib/hitung/sinyal";
import {
  kalimatKesimpulan, nilaiUji, ujiDariIndeks, type HasilUji,
} from "@/lib/hitung/uji-kejadian";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const def = (id: string) => DAFTAR_SINYAL.find((d) => d.id === id)!;
let hari = 0;
const l = (buka: number, tinggi: number, rendah: number, tutup: number, volume?: number): Lilin => ({
  tanggal: `t${String(hari++).padStart(4, "0")}`, buka, tinggi, rendah, tutup, volume,
});
/** Enam lilin merah yang turun satu poin tiap sesi, dari 110. */
const turun = () => Array.from({ length: 6 }, (_, i) => l(111 - i, 111.5 - i, 109.5 - i, 110 - i));
const naik = () => Array.from({ length: 6 }, (_, i) => l(89 + i, 90.5 + i, 88.5 + i, 90 + i));
const terakhir = (d: boolean[]) => d[d.length - 1];

grup("indikator", () => {
  uji("SMA rata-rata n terakhir, null sebelum cukup data", () =>
    samaDengan(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]));

  uji("EMA dibenihi SMA", () => {
    const e = ema([1, 2, 3, 4], 3);
    samaDengan(e[1], null);
    mendekati(e[2]!, 2, 1e-12);
    mendekati(e[3]!, 4 * 0.5 + 2 * 0.5, 1e-12);
  });

  uji("RSI 100 untuk deret yang hanya naik, 0 untuk yang hanya turun", () => {
    const n = Array.from({ length: 20 }, (_, i) => 100 + i);
    samaDengan(rsi(n)[19], 100);
    samaDengan(rsi(n.map((x) => 300 - x))[19], 0);
    samaDengan(rsi(n)[13], null);
  });

  uji("RSI naik-turun seimbang ada di 50", () => {
    const n = Array.from({ length: 40 }, (_, i) => (i % 2 ? 101 : 100));
    mendekati(rsi(n)[39]!, 50, 3);
  });

  uji("MACD garis sinyal baru ada setelah 26 + 9 - 1 titik", () => {
    const m = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
    samaDengan(m.sinyal[32], null);
    benar(m.sinyal[33] !== null);
  });
});

grup("pola lilin", () => {
  uji("bullish engulfing sesudah turun", () => {
    const b = [...turun(), l(105, 105.5, 102.5, 103), l(102.8, 106.5, 102.5, 106)];
    benar(terakhir(def("engulfing-naik").deteksi(b)));
    benar(!terakhir(def("engulfing-turun").deteksi(b)));
  });

  uji("engulfing yang sama di tengah kenaikan tidak dihitung", () => {
    const b = [...naik(), l(97, 97.5, 94.5, 95), l(94.8, 98.5, 94.5, 98)];
    benar(!terakhir(def("engulfing-naik").deteksi(b)));
  });

  uji("bearish engulfing sesudah naik", () => {
    const b = [...naik(), l(95, 97.5, 94.5, 97), l(97.2, 97.5, 93.5, 94)];
    benar(terakhir(def("engulfing-turun").deteksi(b)));
  });

  uji("hammer: ekor bawah panjang, badan kecil di atas", () => {
    const b = [...turun(), l(104, 104.3, 100, 104.2)];
    benar(terakhir(def("hammer").deteksi(b)));
  });

  uji("lilin berbadan besar bukan hammer walau ekornya panjang", () => {
    const b = [...turun(), l(102, 104.3, 100, 104.2)];
    benar(!terakhir(def("hammer").deteksi(b)));
  });

  uji("shooting star sesudah naik", () => {
    const b = [...naik(), l(95.2, 99.5, 95, 95)];
    benar(terakhir(def("shooting-star").deteksi(b)));
  });

  uji("morning star: merah panjang, kecil, hijau lewat tengah", () => {
    const b = [...turun(), l(105, 105.2, 100.8, 101), l(100.5, 101, 100, 100.7), l(100.8, 104, 100.6, 103.8)];
    benar(terakhir(def("morning-star").deteksi(b)));
  });

  uji("hijau yang tidak lewat tengah bukan morning star", () => {
    const b = [...turun(), l(105, 105.2, 100.8, 101), l(100.5, 101, 100, 100.7), l(100.8, 102.5, 100.6, 102.4)];
    benar(!terakhir(def("morning-star").deteksi(b)));
  });

  uji("evening star mencerminkan morning star", () => {
    const b = [...naik(), l(95, 99.2, 94.8, 99), l(99.3, 100, 99, 99.5), l(99.2, 99.4, 95.8, 96)];
    benar(terakhir(def("evening-star").deteksi(b)));
  });
});

grup("breakout dan silang", () => {
  const datar = (n: number, v = 1000) => Array.from({ length: n }, () => l(100, 101, 99, 100, v));

  uji("tembus puncak 20 hari hanya di hari pertama menembus", () => {
    const b = [...datar(25), l(100, 103, 100, 102), l(102, 104, 101, 103.5)];
    const d = def("tembus-20").deteksi(b);
    benar(d[25], "hari tembus");
    benar(!d[26], "hari kedua masih di atas, tapi bukan penembusan baru");
  });

  uji("jebol dasar 20 hari", () => {
    const b = [...datar(25), l(100, 100, 97, 98)];
    benar(terakhir(def("jebol-20").deteksi(b)));
  });

  uji("lonjakan volume butuh dua kali rata-rata dan lilin searah", () => {
    const b = [...datar(25), l(100, 103, 100, 102.5, 2500)];
    benar(terakhir(def("volume-naik").deteksi(b)));
    const lemah = [...datar(25), l(100, 103, 100, 102.5, 1500)];
    benar(!terakhir(def("volume-naik").deteksi(lemah)));
  });

  uji("tanpa data volume, sinyal volume diam, bukan menebak", () => {
    const b = Array.from({ length: 30 }, () => l(100, 103, 99, 102.5));
    samaDengan(def("volume-naik").deteksi(b).some(Boolean), false);
  });

  uji("RSI keluar jenuh jual dihitung sekali per penyeberangan", () => {
    const t = [
      ...Array.from({ length: 20 }, (_, i) => 200 - i * 3),
      ...Array.from({ length: 10 }, (_, i) => 143 + i * 4),
    ];
    const b = t.map((x) => l(x, x + 1, x - 1, x));
    samaDengan(def("rsi-naik").deteksi(b).filter(Boolean).length, 1);
  });
});

grup("kejadian dan level", () => {
  uji("kejadian berdekatan dibuang sampai jendelanya selesai", () =>
    samaDengan(kejadianSinyal([true, true, false, true, false, true], 3), [0, 3]));

  const b = [l(100, 101, 95, 100), l(100, 104, 99, 103), l(103, 106, 102, 105)];

  uji("stop di bawah titik terendah pola, target dari median", () => {
    const x = levelSinyal(b, 2, { ...def("engulfing-naik"), panjangStop: 2 }, 0.04)!;
    samaDengan(x.entry, 105);
    samaDengan(x.stop, 99);
    mendekati(x.target, 109.2, 1e-9);
    mendekati(x.rr, 4.2 / 6, 1e-9);
  });

  uji("median yang tidak searah pola tidak menghasilkan level", () =>
    samaDengan(levelSinyal(b, 2, def("engulfing-naik"), -0.01), null));

  uji("harga yang sudah di bawah stop tidak menghasilkan level", () => {
    const jatuh = [...b, l(105, 105, 90, 91)];
    samaDengan(levelSinyal(jatuh, 2, { ...def("engulfing-naik"), panjangStop: 2 }, 0.04), null);
  });

  uji("sinyal turun: stop di atas puncak pola", () => {
    const x = levelSinyal(b, 2, { ...def("engulfing-turun"), panjangStop: 2 }, -0.05)!;
    samaDengan(x.stop, 106);
    mendekati(x.target, 99.75, 1e-9);
  });
});

grup("kesimpulan", () => {
  const dasar = { n: 1000, rataRata: 0.01, persenNaik: 55 };
  const hasil = (p: number | null, rata: number, n = 10): HasilUji => ({
    horizon: 5, kejadian: Array.from({ length: n }, () => ({ tanggalMasuk: "a", tanggalKeluar: "b", hasil: rata })),
    terlewat: 0, rataRata: rata, median: rata, persenNaik: 70, dasar, peluangKebetulan: p,
    terlaluSedikit: n < 5,
  });

  uji("lolos koreksi uji ganda: punya catatan", () =>
    samaDengan(nilaiUji(hasil(0.001, 0.03), 16, "naik"), { tingkat: "catatan", searah: true }));

  uji("lolos 5% tapi tidak lolos koreksi: petunjuk lemah", () =>
    samaDengan(nilaiUji(hasil(0.02, 0.03), 16, "naik").tingkat, "lemah"));

  uji("di atas 5%: seperti acak", () =>
    samaDengan(nilaiUji(hasil(0.3, 0.03), 16, "naik"), { tingkat: "acak", searah: null }));

  uji("sedikit kejadian: terlalu jarang, berapa pun peluangnya", () =>
    samaDengan(nilaiUji(hasil(0.0001, 0.2, 3), 1, "naik").tingkat, "jarang"));

  uji("simpangan berlawanan dengan klaim pola ditandai tidak searah", () =>
    samaDengan(nilaiUji(hasil(0.001, -0.02), 16, "naik").searah, false));

  uji("kalimat dimulai dengan tindakannya", () => {
    const h = hasil(0.3, 0.012);
    benar(kalimatKesimpulan("Hammer", "MU", h, nilaiUji(h, 16, "naik"), "naik").startsWith("Abaikan."));
    const c = hasil(0.001, 0.03);
    benar(kalimatKesimpulan("Hammer", "MU", c, nilaiUji(c, 16, "naik"), "naik").startsWith("Punya catatan."));
    const b = hasil(0.001, -0.03);
    benar(kalimatKesimpulan("Hammer", "MU", b, nilaiUji(b, 16, "naik"), "naik").includes("sebaliknya"));
  });

  uji("uji dari indeks: titik awal adalah lilin polanya sendiri", () => {
    const deret = [100, 110, 121, 133.1].map((t, i) => ({ tanggal: `d${i}`, tutup: t }));
    const h = ujiDariIndeks(deret, [1], 2);
    samaDengan(h.kejadian[0].tanggalMasuk, "d1");
    mendekati(h.kejadian[0].hasil, 0.21, 1e-9);
  });
});

grup("pola ganda", () => {
  /** Rangkaian harga jadi lilin dengan rentang tipis di sekitar tutupnya. */
  const dariHarga = (harga: number[]): Lilin[] =>
    harga.map((h) => l(h, h + 0.3, h - 0.3, h));

  /** W: turun ke 90, naik ke 100 (leher), turun lagi ke 90, lalu naik
   *  menembus leher di lilin terakhir. */
  const w = (kakiKedua = 90) => dariHarga([
    ...Array.from({ length: 12 }, (_, i) => 100 - i), // 100 turun ke 89
    ...Array.from({ length: 11 }, (_, i) => 89 + i), // naik ke 99
    100, 99.5,
    ...Array.from({ length: 9 }, (_, i) => 99 - i), // turun ke 91
    kakiKedua,
    ...Array.from({ length: 9 }, (_, i) => kakiKedua + 1 + i),
    100.5,
  ]);

  uji("double bottom dikenali di lilin yang menembus leher", () => {
    const b = w();
    const p = polaGanda(b, b.length - 1, "naik")!;
    benar(p !== null, "pola harus ketemu");
    mendekati(p.ekstrem, 88.7, 1e-9);
    mendekati(p.leher, 100.3, 1e-9);
    benar(terakhir(def("double-bottom").deteksi(b)));
  });

  uji("penembusan ditandai sekali, bukan setiap sesi di atas leher", () => {
    const b = [...w(), ...dariHarga([101, 102, 103])];
    samaDengan(def("double-bottom").deteksi(b).filter(Boolean).length, 1);
  });

  uji("kaki kedua yang jauh lebih tinggi bukan double bottom", () => {
    // 96 terhadap 89 itu 7,9%, di atas batas 4%.
    benar(!terakhir(def("double-bottom").deteksi(w(96))));
  });

  uji("stop double bottom ada di kaki, bukan di lilin terakhir", () => {
    const b = w();
    const x = levelSinyal(b, b.length - 1, def("double-bottom"), 0.05)!;
    mendekati(x.stop, 88.7, 1e-9);
    benar(x.entry > 100, "entry di atas leher");
  });

  uji("double top mencerminkan double bottom", () => {
    const m = w().map((x) => l(200 - x.buka, 200 - x.rendah, 200 - x.tinggi, 200 - x.tutup));
    benar(terakhir(def("double-top").deteksi(m)));
    const p = polaGanda(m, m.length - 1, "turun")!;
    mendekati(p.ekstrem, 111.3, 1e-9);
  });

  uji("tren naik mulus tidak menghasilkan pola ganda", () => {
    const b = dariHarga(Array.from({ length: 60 }, (_, i) => 100 + i));
    samaDengan(def("double-bottom").deteksi(b).some(Boolean), false);
    samaDengan(def("double-top").deteksi(b).some(Boolean), false);
  });
});

grup("koreksi, divergensi, dan penyempitan", () => {
  const dariHarga = (harga: number[]): Lilin[] =>
    harga.map((h) => l(h, h + 0.3, h - 0.3, h));
  /** Jalan acak yang bisa diulang, supaya tes tidak bergantung keberuntungan. */
  const acak = (n: number, benih = 7) => {
    let x = benih;
    let h = 100;
    return dariHarga(Array.from({ length: n }, () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      h *= 1 + (x / 2147483648 - 0.5) * 0.06;
      return h;
    }));
  };
  const BARU = [
    "koreksi-tren-naik", "pantulan-tren-turun", "divergensi-naik", "divergensi-turun",
    "sempit-tembus-atas", "sempit-tembus-bawah",
  ];

  uji("Bollinger: deret datar punya pita selebar nol", () => {
    const x = bollinger(Array.from({ length: 25 }, () => 50));
    samaDengan(x.atas[24], 50);
    samaDengan(x.lebar[24], 0);
    samaDengan(x.tengah[18], null);
  });

  uji("Bollinger memakai simpangan baku populasi", () => {
    // 1..4: rata-rata 2,5, simpangan populasi akar 1,25.
    const x = bollinger([1, 2, 3, 4], 4, 2);
    mendekati(x.atas[3]!, 2.5 + 2 * Math.sqrt(1.25), 1e-12);
  });

  uji("tanda di hari i tidak berubah kalau data sesudahnya ditambahkan", () => {
    // Penjaga bocoran masa depan: deteksi atas potongan harus sama dengan
    // deteksi atas deret penuh di indeks yang sama.
    const b = acak(700);
    for (const id of BARU) {
      const penuh = def(id).deteksi(b);
      for (let k = 250; k <= b.length; k += 37) {
        samaDengan(def(id).deteksi(b.slice(0, k))[k - 1], penuh[k - 1], `${id} di ${k}`);
      }
    }
  });

  uji("keenam sinyal baru muncul di jalan acak panjang", () => {
    const b = acak(3000, 11);
    for (const id of BARU) benar(def(id).deteksi(b).some(Boolean), `${id} tidak pernah muncul`);
  });

  /** 220 sesi naik pelan, lalu tiga hari turun tajam yang masih jauh di atas SMA 200. */
  const trenLaluKoreksi = () => dariHarga([
    ...Array.from({ length: 220 }, (_, i) => 100 + i * 0.5),
    205, 201, 197,
  ]);

  uji("koreksi dalam tren naik ditandai sekali, di hari RSI 2 masuk di bawah 10", () => {
    const d = def("koreksi-tren-naik").deteksi(trenLaluKoreksi());
    samaDengan(d.filter(Boolean).length, 1);
    benar(d[220] || d[221], "muncul di awal koreksi");
  });

  uji("koreksi yang sama di bawah SMA 200 tidak dihitung", () => {
    const b = dariHarga([
      ...Array.from({ length: 220 }, (_, i) => 300 - i * 0.5),
      186, 182, 178,
    ]);
    samaDengan(def("koreksi-tren-naik").deteksi(b).some(Boolean), false);
  });

  uji("pantulan dalam tren turun mencerminkan koreksi dalam tren naik", () => {
    const m = trenLaluKoreksi().map((x) => l(400 - x.buka, 400 - x.rendah, 400 - x.tinggi, 400 - x.tutup));
    samaDengan(def("pantulan-tren-turun").deteksi(m).filter(Boolean).length, 1);
  });

  /** Jatuh tajam ke 80 (RSI sangat rendah), pantul ke 90, lalu turun
   *  pelan ke 79 (dasar lebih rendah, RSI lebih tinggi), lalu naik. */
  const divergen = (kakiKedua = 79) => dariHarga([
    ...Array.from({ length: 30 }, (_, i) => 100 + (i % 2) * 0.5),
    96, 92, 88, 84, 80,
    ...Array.from({ length: 10 }, (_, i) => 81 + i),
    ...Array.from({ length: 10 }, (_, i) => 90 - ((90 - kakiKedua) * (i + 1)) / 10),
    ...Array.from({ length: 8 }, (_, i) => kakiKedua + 1 + i),
  ]);

  uji("divergensi naik ditandai SAYAP sesi sesudah dasar kedua", () => {
    const b = divergen();
    const d = def("divergensi-naik").deteksi(b);
    const dasar2 = 54;
    samaDengan(b[dasar2].tutup, 79);
    samaDengan(d.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), [dasar2 + 5]);
  });

  uji("stop divergensi ada di dasar kedua", () => {
    const b = divergen();
    const x = levelSinyal(b, 59, def("divergensi-naik"), 0.05)!;
    mendekati(x.stop, 78.7, 1e-9);
  });

  uji("dasar kedua yang lebih tinggi bukan divergensi naik", () => {
    samaDengan(def("divergensi-naik").deteksi(divergen(82)).some(Boolean), false);
  });

  /** 150 sesi berayun 2 poin, 30 sesi berayun 0,2 poin, lalu melonjak. */
  const sempit = (ayunSempit = 0.2) => dariHarga([
    ...Array.from({ length: 150 }, (_, i) => 100 + (i % 2) * 2),
    ...Array.from({ length: 30 }, (_, i) => 100 + (i % 2) * ayunSempit),
    103,
  ]);

  uji("penyempitan lalu tutup di atas pita atas ditandai", () => {
    benar(terakhir(def("sempit-tembus-atas").deteksi(sempit())));
    benar(!terakhir(def("sempit-tembus-bawah").deteksi(sempit())));
  });

  uji("tembus pita tanpa penyempitan tidak dihitung", () => {
    // Ayunan tetap 2 poin: volatilitasnya tidak pernah mencetak rekor sempit baru.
    samaDengan(def("sempit-tembus-atas").deteksi(sempit(2)).some(Boolean), false);
  });

  uji("stop penyempitan di garis tengah pita", () => {
    const b = sempit();
    const x = levelSinyal(b, b.length - 1, def("sempit-tembus-atas"), 0.05)!;
    const tengah = bollinger(b.map((y) => y.tutup)).tengah[b.length - 1]!;
    mendekati(x.stop, tengah, 1e-9);
  });
});
