/* Menulis satu rencana alokasi kas ke Firestore dari laptop.
 *
 * Pasangan dari tambah-saran.ts. Saran menjawab "apakah aset ini layak",
 * yang ini menjawab "dengan kas segini, sebaiknya dibelanjakan seperti apa".
 * Dipisah karena yang kedua sering justru berisi hubungan antar-saran, dan
 * hubungan itu tidak punya tempat di dokumen yang bercerita tentang satu
 * ticker saja.
 *
 * Pakai:
 *   npm run alokasi -- \
 *     --ringkasan "Target bulan ini sudah tercapai, jadi tidak ada yang menuntut aksi." \
 *     --pos '[{"label":"CVX","jumlah":1250000,"alasan":"risiko 1% dari modal"}]' \
 *     --kas-ditahan 2500000 --total 8537296
 *
 * Wajib: --ringkasan
 * Opsional: --pos <JSON array> --kas-ditahan --total
 *           --mata-uang IDR|USD (bawaan IDR)
 *           --tanggal YYYY-MM-DD (bawaan hari ini)
 *           --uid <uid> (bawaan dari NAKHODA_UID di .env.local)
 */

import { readFileSync } from "node:fs";
import { config as muatEnv } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

muatEnv({ path: ".env.local", quiet: true });

function argumen(): Record<string, string> {
  const hasil: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const nama = a.slice(2);
    const berikut = argv[i + 1];
    if (berikut && !berikut.startsWith("--")) {
      hasil[nama] = berikut;
      i += 1;
    } else {
      hasil[nama] = "true";
    }
  }
  return hasil;
}

/** Menerima "1.250.000" maupun "1250000". Sama seperti di tambah-saran.ts:
 *  angka yang diketik orang Indonesia hampir selalu pakai titik ribuan. */
function angka(teks: string | undefined): number | undefined {
  if (teks === undefined) return undefined;
  const n = Number(teks.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function berhenti(pesan: string): never {
  console.error(`\n  ${pesan}\n`);
  process.exit(1);
}

function mulaiAdmin() {
  if (getApps().length) return;
  const jalur = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!jalur) {
    berhenti(
      "GOOGLE_APPLICATION_CREDENTIALS belum diisi di .env.local.\n" +
        "  Isi dengan jalur ke service account key, dan simpan berkas itu di luar folder repo.",
    );
  }
  try {
    const kunci = JSON.parse(readFileSync(jalur, "utf8"));
    initializeApp({ credential: cert(kunci), projectId: kunci.project_id });
  } catch (e) {
    berhenti(`Gagal membaca service account key di ${jalur}\n  ${(e as Error).message}`);
  }
}

interface Pos {
  label: string;
  jumlah: number;
  alasan?: string;
}

/** Pos dikirim sebagai JSON, bukan sebagai flag berulang, karena tiap pos punya
 *  tiga bagian dan flag berulang bertiga akan pecah begitu ada satu yang lupa
 *  diisi. Kalau JSON-nya rusak, script berhenti alih-alih menyimpan rencana
 *  yang setengah terbaca. */
function uraiPos(teks: string | undefined): Pos[] {
  if (!teks) return [];
  let mentah: unknown;
  try {
    mentah = JSON.parse(teks);
  } catch (e) {
    berhenti(`--pos bukan JSON yang sah.\n  ${(e as Error).message}`);
  }
  if (!Array.isArray(mentah)) berhenti("--pos harus berupa array JSON.");

  return (mentah as Record<string, unknown>[]).map((p, i) => {
    const label = String(p.label ?? "").trim();
    const jumlah = Number(p.jumlah);
    if (!label) berhenti(`Pos ke-${i + 1} tidak punya label.`);
    if (!Number.isFinite(jumlah)) berhenti(`Pos "${label}" jumlahnya bukan angka.`);
    const pos: Pos = { label, jumlah };
    const alasan = String(p.alasan ?? "").trim();
    if (alasan) pos.alasan = alasan;
    return pos;
  });
}

async function jalan() {
  const arg = argumen();

  const ringkasan = (arg.ringkasan ?? "").trim();
  if (!ringkasan) {
    berhenti(
      "--ringkasan wajib diisi.\n" +
        "  Tabel angka tanpa kalimat pendapat cuma daftar belanja, dan daftar\n" +
        "  belanja tidak bisa dinilai ulang tiga bulan lagi.",
    );
  }

  const uid = arg.uid ?? process.env.NAKHODA_UID;
  if (!uid) {
    berhenti(
      "uid pengguna belum diketahui.\n" +
        "  Isi NAKHODA_UID di .env.local, atau kirim lewat --uid <uid>.",
    );
  }

  const pos = uraiPos(arg.pos);
  const mataUang = arg["mata-uang"] === "USD" ? "USD" : "IDR";

  const dokumen = {
    uid,
    tanggal: arg.tanggal ?? hariIni(),
    sumber: arg.sumber ?? "claude-code",
    ringkasan,
    pos,
    kasDitahan: angka(arg["kas-ditahan"]),
    totalSaatItu: angka(arg.total),
    mataUang,
    dibuatPada: Date.now(),
  };

  const bersih = Object.fromEntries(
    Object.entries(dokumen).filter(([, v]) => v !== undefined),
  );

  mulaiAdmin();
  const ref = await getFirestore().collection("allocationPlans").add(bersih);

  const rupiah = (n: number) =>
    `${mataUang === "IDR" ? "Rp " : "$"}${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

  console.log(`\n  Rencana alokasi tersimpan: ${dokumen.tanggal}`);
  for (const p of pos) console.log(`    ${p.label.padEnd(14)} ${rupiah(p.jumlah)}`);
  if (dokumen.kasDitahan !== undefined) {
    console.log(`    ${"kas ditahan".padEnd(14)} ${rupiah(dokumen.kasDitahan)}`);
  }
  console.log(`  Dokumen: allocationPlans/${ref.id}\n`);
}

jalan().catch((e) => {
  console.error(e);
  process.exit(1);
});
