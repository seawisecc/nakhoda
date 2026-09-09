/* Menyimpan kunci API ke .env.local tanpa melewati riwayat shell.
 *
 *   npm run kunci
 *
 * Kunci diketik dengan gema dimatikan, jadi tidak muncul di layar, tidak masuk
 * ~/.zsh_history, dan tidak tertinggal di scrollback terminal. Menempelkannya
 * langsung sebagai argumen perintah akan meninggalkan jejak di ketiganya.
 *
 * Kunci Finnhub diuji ke API-nya sebelum disimpan. Kunci yang salah ketik akan
 * terlihat sebagai "harga saham tidak pernah ter-update" berhari-hari kemudian,
 * dan itu jenis kegagalan yang paling lama disadari.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const BERKAS = ".env.local";

interface Kunci {
  nama: string;
  label: string;
  petunjuk: string;
  uji?: (nilai: string) => Promise<string | null>;
}

const DAFTAR: Kunci[] = [
  {
    nama: "FINNHUB_API_KEY",
    label: "Kunci Finnhub",
    petunjuk: "Ambil di https://finnhub.io/dashboard, kotak API Key di bagian atas.",
    async uji(nilai) {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${nilai}`);
      if (r.status === 401 || r.status === 403) return "Finnhub menolak kunci ini.";
      if (!r.ok) return `Finnhub membalas ${r.status}.`;
      const j = (await r.json()) as { c?: number };
      if (typeof j.c !== "number" || j.c <= 0) return "Kunci diterima tapi tidak mengembalikan harga.";
      return null;
    },
  },
];

/** Membaca satu baris dengan gema dimatikan. */
function tanyaRahasia(pertanyaan: string): Promise<string> {
  return new Promise((selesai) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(pertanyaan);
    // readline tidak punya mode rahasia bawaan, jadi penulisan ke layar
    // dibajak sementara selama pertanyaan ini saja.
    const tulisAsli = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
    rl.question("", (jawab) => {
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = tulisAsli;
      process.stdout.write("\n");
      rl.close();
      selesai(jawab.trim());
    });
  });
}

function pasang(isi: string, nama: string, nilai: string): string {
  const baris = `${nama}=${nilai}`;
  const pola = new RegExp(`^${nama}=.*$`, "m");
  return pola.test(isi) ? isi.replace(pola, baris) : `${isi.trimEnd()}\n${baris}\n`;
}

async function jalan() {
  let isi: string;
  try {
    isi = readFileSync(BERKAS, "utf8");
  } catch {
    console.error(`\n  ${BERKAS} tidak ditemukan. Jalankan dari folder Nakhoda.\n`);
    process.exit(1);
  }

  const diminta = process.argv[2]?.toUpperCase();
  const target = diminta
    ? DAFTAR.filter((k) => k.nama.includes(diminta))
    : DAFTAR;

  if (!target.length) {
    console.error(`\n  Tidak ada kunci bernama "${diminta}". Yang tersedia: ${DAFTAR.map((k) => k.nama).join(", ")}\n`);
    process.exit(1);
  }

  for (const k of target) {
    const sudahAda = new RegExp(`^${k.nama}=.+$`, "m").test(isi);
    console.log(`\n  ${k.label}${sudahAda ? " (sudah terisi, akan ditimpa)" : ""}`);
    console.log(`  ${k.petunjuk}`);
    const nilai = await tanyaRahasia("  Tempel di sini lalu Enter (tidak akan terlihat): ");

    if (!nilai) {
      console.log("  Dilewati, tidak ada yang diubah.");
      continue;
    }

    if (k.uji) {
      process.stdout.write("  Menguji ke servernya… ");
      try {
        const galat = await k.uji(nilai);
        if (galat) {
          console.log(`GAGAL\n  ${galat} Tidak disimpan.`);
          continue;
        }
        console.log("berhasil.");
      } catch (e) {
        console.log(`tidak bisa dihubungi (${(e as Error).message}). Tetap disimpan.`);
      }
    }

    isi = pasang(isi, k.nama, nilai);
    writeFileSync(BERKAS, isi);
    console.log(`  ${k.nama} tersimpan di ${BERKAS}.`);
  }

  console.log("\n  Jalankan `npm run build` supaya nilainya terpakai.\n");
}

jalan().catch((e) => {
  console.error(e);
  process.exit(1);
});
