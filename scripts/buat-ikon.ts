/* Membuat ikon PNG dan favicon dari public/ikon.svg dan public/ikon-kecil.svg.
 *
 * Dijalankan manual saat lambang berubah, bukan saat build. Hasilnya ikut
 * masuk repo supaya build di Vercel tidak perlu sharp sama sekali.
 *
 *   npx tsx scripts/buat-ikon.ts
 *
 * Dua sumber, bukan satu: ikon.svg untuk ukuran besar (PWA, layar rumah),
 * ikon-kecil.svg untuk ukuran tab. Alasannya ada di komentar ikon-kecil.svg.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const publik = join(process.cwd(), "public");
const svg = readFileSync(join(publik, "ikon.svg"));
const svgKecil = readFileSync(join(publik, "ikon-kecil.svg"));

const UKURAN: { nama: string; px: number }[] = [
  { nama: "ikon-192.png", px: 192 },
  { nama: "ikon-512.png", px: 512 },
  { nama: "ikon-180.png", px: 180 },
];

async function jalan() {
  mkdirSync(publik, { recursive: true });

  for (const { nama, px } of UKURAN) {
    const buf = await sharp(svg, { density: 384 }).resize(px, px).png().toBuffer();
    writeFileSync(join(publik, nama), buf);
    console.log(`  ${nama}  ${px}×${px}`);
  }

  // Ikon maskable dipotong Android jadi lingkaran atau kotak membulat, dan
  // potongannya bisa memakan sampai 20% di tiap sisi. Karena itu lambang
  // dikecilkan ke dalam zona aman lalu dilatari warna penuh sampai tepi.
  const inti = await sharp(svg, { density: 384 }).resize(328, 328).png().toBuffer();
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background: "#0c0b0a" },
  })
    .composite([{ input: inti, top: 92, left: 92 }])
    .png()
    .toBuffer();
  writeFileSync(join(publik, "ikon-maskable-512.png"), maskable);
  console.log("  ikon-maskable-512.png  512×512 (zona aman 80%)");

  // Favicon. Sengaja di public/, bukan di src/app/favicon.ico: metadata
  // berbasis berkas di App Router mengalahkan seluruh objek `metadata.icons`,
  // dan objek itu yang memegang ikon SVG, ikon 192, dan apple-touch. Menaruh
  // .ico di public/ membuatnya tetap terlayani di /favicon.ico untuk peminta
  // lawas, tanpa merebut kendali dari layout.
  const pngKecil: { px: number; buf: Buffer }[] = [];
  for (const px of [16, 32, 48]) {
    const buf = await sharp(svgKecil, { density: 512 }).resize(px, px).png().toBuffer();
    pngKecil.push({ px, buf });
  }
  writeFileSync(join(publik, "favicon.ico"), rakitIco(pngKecil));
  console.log("  favicon.ico  16+32+48 (dari ikon-kecil.svg)");

  const png32 = pngKecil.find((p) => p.px === 32)!.buf;
  writeFileSync(join(publik, "ikon-32.png"), png32);
  console.log("  ikon-32.png  32×32");
}

/** Membungkus beberapa PNG jadi satu berkas .ico.
 *
 *  ICO modern boleh memuat PNG apa adanya, jadi tidak perlu encoder BMP:
 *  cukup header 6 byte, satu entri direktori 16 byte per ukuran, lalu data
 *  PNG-nya disambung. sharp sendiri tidak bisa menulis .ico. */
function rakitIco(gambar: readonly { px: number; buf: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // cadangan, selalu 0
  header.writeUInt16LE(1, 2); // tipe 1 = ikon
  header.writeUInt16LE(gambar.length, 4);

  const direktori = Buffer.alloc(16 * gambar.length);
  let offset = header.length + direktori.length;
  gambar.forEach((g, i) => {
    const d = i * 16;
    // 256 px ditulis sebagai 0; ukuran di sini semuanya di bawah itu.
    direktori.writeUInt8(g.px, d);
    direktori.writeUInt8(g.px, d + 1);
    direktori.writeUInt8(0, d + 2); // jumlah warna palet, 0 untuk true color
    direktori.writeUInt8(0, d + 3); // cadangan
    direktori.writeUInt16LE(1, d + 4); // bidang warna
    direktori.writeUInt16LE(32, d + 6); // bit per piksel
    direktori.writeUInt32LE(g.buf.length, d + 8);
    direktori.writeUInt32LE(offset, d + 12);
    offset += g.buf.length;
  });

  return Buffer.concat([header, direktori, ...gambar.map((g) => g.buf)]);
}

jalan().catch((e) => {
  console.error(e);
  process.exit(1);
});
