/* Runner tes seadanya. Nakhoda tidak memakai framework tes karena yang perlu
 * diuji hanyalah fungsi murni di src/lib/hitung, dan menambah Vitest untuk itu
 * berarti menambah puluhan dependensi demi tiga assertion. */

let total = 0;
let gagal = 0;
const kegagalan: string[] = [];
let grupSekarang = "";

export function grup(nama: string, isi: () => void) {
  grupSekarang = nama;
  isi();
  grupSekarang = "";
}

export function uji(nama: string, isi: () => void) {
  total += 1;
  const label = grupSekarang ? `${grupSekarang} › ${nama}` : nama;
  try {
    isi();
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${label}\n`);
  } catch (e) {
    gagal += 1;
    kegagalan.push(`${label}\n      ${(e as Error).message}`);
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${label}\n`);
  }
}

export function samaDengan(dapat: unknown, harap: unknown, pesan = "") {
  const a = JSON.stringify(dapat);
  const b = JSON.stringify(harap);
  if (a !== b) throw new Error(`${pesan}\n      dapat: ${a}\n      harap: ${b}`);
}

/** Perbandingan angka pecahan. Toleransi default cukup ketat untuk menangkap
 *  kesalahan rumus, tapi longgar terhadap galat floating point biasa. */
export function mendekati(dapat: number, harap: number, toleransi = 1e-6, pesan = "") {
  if (!Number.isFinite(dapat)) throw new Error(`${pesan} dapat bukan angka: ${dapat}`);
  if (Math.abs(dapat - harap) > toleransi) {
    throw new Error(`${pesan}\n      dapat: ${dapat}\n      harap: ${harap} (±${toleransi})`);
  }
}

export function benar(nilai: unknown, pesan = "harusnya benar") {
  if (!nilai) throw new Error(pesan);
}

export function ringkasan() {
  process.stdout.write("\n");
  if (gagal) {
    process.stdout.write(`\x1b[31m${gagal} dari ${total} tes gagal\x1b[0m\n\n`);
    for (const k of kegagalan) process.stdout.write(`  • ${k}\n\n`);
    process.exit(1);
  }
  process.stdout.write(`\x1b[32m${total} tes lulus\x1b[0m\n`);
}
