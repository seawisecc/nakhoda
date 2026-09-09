/* Menulis satu saran ke Firestore dari laptop.
 *
 * Ini yang membuat riset di sesi Claude Code tidak menguap begitu percakapan
 * ditutup: hasilnya masuk ke app sebagai catatan terstruktur yang nanti bisa
 * dinilai, bukan sekadar keputusan yang diingat samar-samar.
 *
 * Memakai Firebase Admin SDK, yang melewati seluruh aturan keamanan, jadi
 * tidak perlu login. Konsekuensinya: service account key harus tetap di
 * laptop dan di luar git. Kalau bocor, siapa pun bisa membaca dan menulis
 * seluruh data.
 *
 * Pakai:
 *   npm run saran -- --ticker NVDA --rekomendasi beli \
 *     --teknikal "Breakout dari konsolidasi tiga minggu" \
 *     --fundamental "Guidance dinaikkan dua kuartal beruntun" \
 *     --entry 228,45 --stop 210 --target 250
 *
 * Wajib: --ticker, --rekomendasi
 * Opsional: --teknikal --fundamental --entry --stop --target
 *           --jenis saham|kripto (bawaan saham)
 *           --mata-uang USD|IDR (bawaan USD)
 *           --tanggal YYYY-MM-DD (bawaan hari ini)
 *           --uid <uid>  (bawaan dari NAKHODA_UID di .env.local)
 */

import { readFileSync } from "node:fs";
import { config as muatEnv } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

muatEnv({ path: ".env.local", quiet: true });

const REKOMENDASI = ["beli", "tahan", "jual", "pantau"] as const;
type Rekomendasi = (typeof REKOMENDASI)[number];

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

/** Menerima "228,45" maupun "228.45". Angka yang diketik orang Indonesia
 *  hampir selalu pakai koma, dan menolaknya di sini cuma bikin jengkel. */
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

async function jalan() {
  const arg = argumen();

  const ticker = (arg.ticker ?? "").trim().toUpperCase();
  if (!ticker) berhenti("--ticker wajib diisi. Contoh: --ticker NVDA");

  const rekomendasi = (arg.rekomendasi ?? "").trim().toLowerCase() as Rekomendasi;
  if (!REKOMENDASI.includes(rekomendasi)) {
    berhenti(`--rekomendasi harus salah satu dari: ${REKOMENDASI.join(", ")}`);
  }

  const uid = arg.uid ?? process.env.NAKHODA_UID;
  if (!uid) {
    berhenti(
      "uid pengguna belum diketahui.\n" +
        "  Isi NAKHODA_UID di .env.local, atau kirim lewat --uid <uid>.\n" +
        "  uid bisa dilihat di Firebase Console > Authentication > Users.",
    );
  }

  const jenisAset = arg.jenis === "kripto" ? "kripto" : "saham";
  const mataUang = arg["mata-uang"] === "IDR" ? "IDR" : "USD";

  const dokumen = {
    uid,
    ticker,
    jenisAset,
    tanggal: arg.tanggal ?? hariIni(),
    sumber: arg.sumber ?? "claude-code",
    rekomendasi,
    catatanTeknikal: arg.teknikal ?? "",
    catatanFundamental: arg.fundamental ?? "",
    entrySaran: angka(arg.entry),
    stopSaran: angka(arg.stop),
    targetSaran: angka(arg.target),
    mataUang,
    status: "menunggu" as const,
    dibuatPada: Date.now(),
  };

  // Firestore menolak field bernilai undefined, dan harga saran memang boleh
  // tidak diisi kalau rekomendasinya cuma "pantau".
  const bersih = Object.fromEntries(
    Object.entries(dokumen).filter(([, v]) => v !== undefined),
  );

  mulaiAdmin();
  const db = getFirestore();
  const ref = await db.collection("suggestions").add(bersih);

  console.log(`\n  Saran tersimpan: ${ticker} (${rekomendasi})`);
  console.log(`  Dokumen: suggestions/${ref.id}`);
  console.log("  Entri akan muncul di app secara realtime, tanpa perlu refresh.\n");
}

jalan().catch((e) => {
  console.error(e);
  process.exit(1);
});
