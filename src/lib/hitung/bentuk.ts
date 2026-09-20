import {
  daftarPivot, garisTren, hargaGaris, levelMendatar, polaGanda, polaGandaTerbentuk,
  type Lilin,
} from "./sinyal";
import type { Arah } from "./uji-kejadian";

/* Bentuk yang sedang ada di chart: garis tren, level mendatar, segitiga,
 * dan pola ganda yang kakinya sudah lengkap.
 *
 * Bedanya dengan sinyal: sinyal adalah PERISTIWA yang sudah terjadi dan
 * punya catatan uji. Bentuk adalah KEADAAN yang sedang berlangsung, dan
 * keadaan tidak bisa diuji dengan cara yang sama; yang bisa diuji adalah
 * penembusannya. Karena itu tiap bentuk membawa `sinyalUji`, id sinyal yang
 * menguji penembusan bentuk itu, supaya gambar di chart dan angka di tabel
 * bicara tentang hal yang sama.
 *
 * Semua bentuk di sini ditarik dari titik balik yang sudah terkonfirmasi.
 * Tidak ada yang digambar dari "kelihatannya", dan karena itu gambarnya
 * kadang tidak sama dengan yang akan digambar orang dengan tangan.
 */

export interface TitikGaris {
  tanggal: string;
  harga: number;
}

export interface GarisBentuk {
  titik: TitikGaris[];
  /** Putus-putus dipakai untuk perpanjangan ke depan, bagian yang belum
   *  terjadi, supaya tidak terbaca sebagai harga yang sudah tercatat. */
  putus?: boolean;
}

export interface Bentuk {
  id: string;
  judul: string;
  keterangan: string;
  garis: GarisBentuk[];
  /** Harga yang menentukan bentuk ini berlanjut atau selesai. */
  pemicu: { harga: number; arah: Arah; kalimat: string } | null;
  /** Id sinyal yang menguji penembusan bentuk ini, kalau ada. */
  sinyalUji: string | null;
}

const titik = (b: Lilin[], i: number, harga: number): TitikGaris => ({ tanggal: b[i].tanggal, harga });

/** Semua bentuk yang berlaku di lilin terakhir. */
export function cariBentuk(b: Lilin[]): Bentuk[] {
  const i = b.length - 1;
  if (i < 30) return [];
  const hasil: Bentuk[] = [];
  const pivotBawah = daftarPivot(b, "naik");
  const pivotAtas = daftarPivot(b, "turun");
  const kini = b[i].tutup;
  const jarak = (h: number) => `${h > kini ? "+" : ""}${(((h - kini) / kini) * 100).toFixed(1)}%`;

  const turun = garisTren(b, i, "turun", pivotAtas);
  if (turun) {
    const hargaKini = hargaGaris(turun, i);
    hasil.push({
      id: "tren-turun",
      judul: "Garis tren turun",
      keterangan: `${turun.sentuh} puncak yang makin rendah. Selama harga di bawahnya, penjual masih memegang kendali.`,
      garis: [{
        titik: [
          titik(b, turun.dari, turun.hargaDari),
          titik(b, turun.sampai, turun.hargaSampai),
          titik(b, i, hargaKini),
        ],
      }],
      pemicu: {
        harga: hargaKini,
        arah: "naik",
        kalimat: `Tutup di atas ${hargaKini.toFixed(2)} (${jarak(hargaKini)}) mematahkan garis ini.`,
      },
      sinyalUji: "tembus-tren-turun",
    });
  }

  const naik = garisTren(b, i, "naik", pivotBawah);
  if (naik) {
    const hargaKini = hargaGaris(naik, i);
    hasil.push({
      id: "tren-naik",
      judul: "Garis tren naik",
      keterangan: `${naik.sentuh} dasar yang makin tinggi. Garis inilah yang sedang menahan harga.`,
      garis: [{
        titik: [
          titik(b, naik.dari, naik.hargaDari),
          titik(b, naik.sampai, naik.hargaSampai),
          titik(b, i, hargaKini),
        ],
      }],
      pemicu: {
        harga: hargaKini,
        arah: "turun",
        kalimat: `Tutup di bawah ${hargaKini.toFixed(2)} (${jarak(hargaKini)}) mematahkan garis ini.`,
      },
      sinyalUji: "jebol-tren-naik",
    });
  }

  // Segitiga: dua garis yang saling mendekat. Yang menyempit berarti rentang
  // hariannya mengecil, dan rentang yang mengecil selalu berakhir dengan
  // penembusan ke salah satu sisi; yang tidak diketahui adalah sisi mana.
  if (turun && naik) {
    const atasKini = hargaGaris(turun, i);
    const bawahKini = hargaGaris(naik, i);
    const atasAwal = hargaGaris(turun, Math.min(turun.dari, naik.dari));
    const bawahAwal = hargaGaris(naik, Math.min(turun.dari, naik.dari));
    if (atasKini > bawahKini && atasKini - bawahKini < (atasAwal - bawahAwal) * 0.8) {
      hasil.push({
        id: "segitiga",
        judul: "Segitiga menyempit",
        keterangan: `Jarak puncak ke dasar mengecil, sekarang ${(((atasKini - bawahKini) / kini) * 100).toFixed(1)}% dari harga. Penembusannya bisa ke atas atau ke bawah; arahnya tidak bisa ditebak dari bentuknya.`,
        garis: [],
        pemicu: null,
        sinyalUji: null,
      });
    }
  }

  const resisten = levelMendatar(b, i, "turun", pivotAtas);
  if (resisten) {
    hasil.push({
      id: "resisten",
      judul: "Resisten mendatar",
      keterangan: `${resisten.titik.length} puncak berhenti di harga yang hampir sama.`,
      garis: [{
        titik: [titik(b, resisten.titik[0], resisten.harga), titik(b, i, resisten.harga)],
      }],
      pemicu: {
        harga: resisten.harga,
        arah: "naik",
        kalimat: `Tutup di atas ${resisten.harga.toFixed(2)} (${jarak(resisten.harga)}) menembus level ini.`,
      },
      sinyalUji: "tembus-resisten",
    });
  }

  const support = levelMendatar(b, i, "naik", pivotBawah);
  if (support) {
    hasil.push({
      id: "support",
      judul: "Support mendatar",
      keterangan: `${support.titik.length} dasar berhenti di harga yang hampir sama.`,
      garis: [{
        titik: [titik(b, support.titik[0], support.harga), titik(b, i, support.harga)],
      }],
      pemicu: {
        harga: support.harga,
        arah: "turun",
        kalimat: `Tutup di bawah ${support.harga.toFixed(2)} (${jarak(support.harga)}) menjebol level ini.`,
      },
      sinyalUji: "jebol-support",
    });
  }

  for (const arah of ["naik", "turun"] as const) {
    const nama = arah === "naik" ? "Double bottom" : "Double top";
    const sedang = polaGandaTerbentuk(b, i, arah);
    // Penembusan yang baru saja terjadi tetap digambar beberapa sesi, karena
    // bentuknya masih yang menjelaskan gerak harga sekarang.
    const tembus = [0, 1, 2, 3].map((k) => polaGanda(b, i - k, arah)).find(Boolean) ?? null;
    const p = sedang ?? tembus;
    if (!p) continue;
    let puncak = p.kaki1;
    for (let j = p.kaki1; j <= p.kaki2; j += 1) {
      const lebihJauh = arah === "naik"
        ? b[j].tinggi > b[puncak].tinggi
        : b[j].rendah < b[puncak].rendah;
      if (lebihJauh) puncak = j;
    }
    const kakiHarga = (j: number) => (arah === "naik" ? b[j].rendah : b[j].tinggi);
    hasil.push({
      id: arah === "naik" ? "double-bottom" : "double-top",
      judul: sedang ? `${nama} sedang terbentuk` : `${nama} sudah tembus`,
      keterangan: sedang
        ? `Dua ${arah === "naik" ? "dasar" : "puncak"} sejajar. Polanya belum jadi sampai lehernya ditembus, dan sebagian besar memang tidak pernah menembus.`
        : `Lehernya sudah ditembus. Bentuknya digambar supaya terlihat dari mana angkanya.`,
      garis: [
        {
          titik: [
            titik(b, p.kaki1, kakiHarga(p.kaki1)),
            titik(b, puncak, p.leher),
            titik(b, p.kaki2, kakiHarga(p.kaki2)),
          ],
        },
        { titik: [titik(b, p.kaki1, p.leher), titik(b, i, p.leher)], putus: true },
      ],
      pemicu: sedang
        ? {
          harga: p.leher,
          arah,
          kalimat: `Tutup ${arah === "naik" ? "di atas" : "di bawah"} ${p.leher.toFixed(2)} (${jarak(p.leher)}) menyelesaikan polanya.`,
        }
        : null,
      sinyalUji: arah === "naik" ? "double-bottom" : "double-top",
    });
  }

  return hasil;
}
