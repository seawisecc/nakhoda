import {
  cariAspek, cariSemuaAspek, indeksBatangSejak, jarakSudut, tanggalUtc, ujiAspek,
  type BatangHarian, type Planet,
} from "@/lib/hitung/astro";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const HARI = 86_400_000;
const utc = (s: string) => Date.parse(`${s}T00:00:00Z`);

/* Gerak rekaan: a berputar 1° sehari dari 0°, b diam di 0°. Aspek apa pun
   jatuh di hari yang bisa dihitung dengan kepala, jadi logika pencariannya
   teruji terpisah dari ephemerisnya. */
const AWAL = utc("2020-01-01");
const linear = (p: Planet, t: number) => (p === "mars" ? ((t - AWAL) / HARI) % 360 : 0);

grup("aspek, gerak rekaan", () => {
  uji("square ditemukan di kedua sisinya: 90° dan 270°", () => {
    const k = cariAspek("mars", "jupiter", "square", AWAL, AWAL + 360 * HARI, linear);
    samaDengan(k.length, 2);
    mendekati((k[0].waktu - AWAL) / HARI, 90, 1e-6);
    mendekati((k[1].waktu - AWAL) / HARI, 270, 1e-6);
  });

  uji("oposisi terdeteksi, walau jarak sudutnya tidak pernah melewati 180", () => {
    const k = cariAspek("mars", "jupiter", "oposisi", AWAL, AWAL + 360 * HARI, linear);
    samaDengan(k.length, 1);
    mendekati((k[0].waktu - AWAL) / HARI, 180, 1e-6);
  });

  uji("konjungsi tidak tercatat dua kali saat jatuh tepat di titik sampel", () => {
    // Hari ke-360 adalah 0° lagi, tepat di sampel harian.
    const k = cariAspek("mars", "jupiter", "konjungsi", AWAL + HARI, AWAL + 400 * HARI, linear);
    samaDengan(k.length, 1);
    mendekati((k[0].waktu - AWAL) / HARI, 360, 1e-6);
  });

  uji("planet yang sama atau rentang terbalik mengembalikan kosong", () => {
    samaDengan(cariAspek("mars", "mars", "square", AWAL, AWAL + 400 * HARI, linear).length, 0);
    samaDengan(cariAspek("mars", "jupiter", "square", AWAL + HARI, AWAL, linear).length, 0);
  });

  uji("jarak sudut selalu 0 sampai 180", () => {
    mendekati(jarakSudut(350, 10), 20, 1e-9);
    mendekati(jarakSudut(10, 190), 180, 1e-9);
  });
});

grup("aspek, ephemeris sungguhan", () => {
  uji("konjungsi agung Jupiter-Saturnus 21 Des 2020, sekitar 18:20 UTC", () => {
    const k = cariAspek("jupiter", "saturnus", "konjungsi", utc("2020-06-01"), utc("2021-06-01"));
    samaDengan(k.length, 1);
    const target = Date.parse("2020-12-21T18:20:00Z");
    benar(Math.abs(k[0].waktu - target) < 3 * 3_600_000, `meleset: ${new Date(k[0].waktu).toISOString()}`);
  });

  uji("retrograde: Saturnus square Uranus eksak tiga kali di 2021", () => {
    const k = cariAspek("saturnus", "uranus", "square", utc("2021-01-01"), utc("2022-01-01"));
    samaDengan(k.map((x) => tanggalUtc(x.waktu)), ["2021-02-17", "2021-06-14", "2021-12-24"]);
  });

  uji("Jupiter konjungsi Pluto tiga kali di 2020", () => {
    const k = cariAspek("jupiter", "pluto", "konjungsi", utc("2020-01-01"), utc("2021-01-01"));
    samaDengan(k.map((x) => tanggalUtc(x.waktu)), ["2020-04-05", "2020-06-30", "2020-11-12"]);
  });
});

/* Deret harian rekaan: naik 1% setiap sesi, kecuali satu sesi anjlok. */
function deret(n: number, anjlokDi = -1): BatangHarian[] {
  const b: BatangHarian[] = [];
  let harga = 100;
  for (let i = 0; i < n; i += 1) {
    b.push({ tanggal: tanggalUtc(utc("2024-01-01") + i * HARI), tutup: harga });
    harga *= i + 1 === anjlokDi ? 0.5 : 1.01;
  }
  return b;
}

grup("uji aspek", () => {
  uji("titik awal adalah tutup sebelum hari aspek, bukan di hari itu", () => {
    const b = deret(30);
    const h = ujiAspek(b, [Date.parse("2024-01-10T15:00:00Z")], 1);
    samaDengan(h.kejadian[0].tanggalMasuk, "2024-01-09");
    samaDengan(h.kejadian[0].tanggalKeluar, "2024-01-10");
  });

  uji("return dihitung sebagai rasio tutup", () => {
    const h = ujiAspek(deret(30), [utc("2024-01-10")], 5);
    mendekati(h.kejadian[0].hasil, 1.01 ** 5 - 1, 1e-9);
  });

  uji("aspek di akhir pekan memakai sesi bursa terakhir sebelumnya", () => {
    // Sesi Jumat 5 Jan lalu Senin 8 Jan; aspek jatuh Sabtu.
    const b: BatangHarian[] = [
      { tanggal: "2024-01-04", tutup: 100 },
      { tanggal: "2024-01-05", tutup: 110 },
      { tanggal: "2024-01-08", tutup: 121 },
    ];
    const h = ujiAspek(b, [utc("2024-01-06")], 1);
    samaDengan(h.kejadian[0].tanggalMasuk, "2024-01-05");
    mendekati(h.kejadian[0].hasil, 0.1, 1e-9);
  });

  uji("aspek sebelum data atau yang jendelanya belum selesai dihitung terlewat", () => {
    const h = ujiAspek(deret(10), [utc("2023-06-01"), utc("2024-01-09"), utc("2025-01-01")], 3);
    samaDengan(h.kejadian.length, 0);
    samaDengan(h.terlewat, 3);
    samaDengan(h.rataRata, null);
  });

  uji("di bawah lima kejadian ditandai terlalu sedikit", () => {
    const b = deret(60);
    const w = [5, 10, 15, 20].map((i) => utc("2024-01-01") + i * HARI);
    benar(ujiAspek(b, w, 2).terlaluSedikit);
    benar(!ujiAspek(b, [...w, utc("2024-01-01") + 25 * HARI], 2).terlaluSedikit);
  });

  uji("return yang sama dengan dasar tidak pernah tampak bermakna", () => {
    // Setiap jendela naik tepat 1,01^h, jadi aspek tidak bisa berbeda dari
    // hari acak mana pun, dan peluang kebetulannya harus penuh.
    const b = deret(200);
    const w = [10, 40, 70, 100, 130, 160].map((i) => utc("2024-01-01") + i * HARI);
    const h = ujiAspek(b, w, 5);
    mendekati(h.rataRata!, h.dasar!.rataRata, 1e-12);
    samaDengan(h.peluangKebetulan, 1);
  });

  uji("anjlok yang hanya ada di jendela aspek tampak jarang terjadi secara acak", () => {
    // Satu kejadian, tepat di sesi anjlok 50%; dari 200 titik acak, hanya
    // jendela yang memuat sesi itu yang bisa menyamainya.
    const b = deret(200, 100);
    const h = ujiAspek(b, [utc("2024-01-01") + 100 * HARI], 1);
    mendekati(h.kejadian[0].hasil, -0.5, 1e-9);
    benar(h.peluangKebetulan! < 0.05, `peluang ${h.peluangKebetulan}`);
  });

  uji("hasil sama setiap kali dijalankan", () => {
    const b = deret(200, 100);
    const w = [30, 100, 150].map((i) => utc("2024-01-01") + i * HARI);
    samaDengan(ujiAspek(b, w, 3).peluangKebetulan, ujiAspek(b, w, 3).peluangKebetulan);
  });

  uji("indeks batang sejak: tepat, di antara, dan sesudah akhir", () => {
    const b = deret(5);
    samaDengan(indeksBatangSejak(b, "2024-01-03"), 2);
    samaDengan(indeksBatangSejak(b, "2023-12-01"), 0);
    samaDengan(indeksBatangSejak(b, "2025-01-01"), -1);
  });
});

grup("semua aspek", () => {
  uji("gabungan sama dengan pencarian satu per satu, urut menurut waktu", () => {
    const dari = utc("2015-01-01");
    const sampai = utc("2026-01-01");
    const gabung = cariSemuaAspek("mars", "jupiter", ["square", "trigon"], dari, sampai);
    const terpisah = [
      ...cariAspek("mars", "jupiter", "square", dari, sampai),
      ...cariAspek("mars", "jupiter", "trigon", dari, sampai),
    ].sort((x, y) => x.waktu - y.waktu);
    samaDengan(gabung, terpisah);
    benar(gabung.length > 10, `terlalu sedikit: ${gabung.length}`);
  });
});
