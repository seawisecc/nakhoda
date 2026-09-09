/* Watcher riset.
 *
 * Halaman web tidak punya jalur masuk ke Claude Code yang jalan di laptop, jadi
 * arahnya dibalik: app menulis permintaan ke Firestore, script ini yang
 * mengambil dan mengerjakannya lewat `claude -p`, lalu menulis hasilnya balik
 * sebagai saran.
 *
 * Jalankan dan biarkan hidup:
 *
 *   npm run pantau
 *
 * Konsekuensi yang harus disadari: permintaan hanya dikerjakan selama script
 * ini hidup. Kalau laptop mati, permintaan menumpuk dan baru dikerjakan saat
 * script dijalankan lagi. App menampilkan status itu apa adanya, tidak
 * berpura-pura sedang memproses.
 *
 * Tiap panggilan memakai kuota langganan Claude Code, bukan gratis.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { config as muatEnv } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { PermintaanRiset } from "../src/types";
import { MAKS_SARAN, susunPrompt } from "../src/lib/riset";

muatEnv({ path: ".env.local", quiet: true });

const KOLEKSI_PERMINTAAN = "researchRequests";
const KOLEKSI_SARAN = "suggestions";
/* Satu permintaan boleh berjalan lama karena Claude perlu menelusuri web.
 * Lebih baik menunggu daripada memotong analisis di tengah. */
const BATAS_WAKTU_MS = 12 * 60 * 1000;

function berhenti(pesan: string): never {
  console.error(`\n  ${pesan}\n`);
  process.exit(1);
}

function mulaiAdmin(): Firestore {
  if (!getApps().length) {
    const jalur = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!jalur) {
      berhenti(
        "GOOGLE_APPLICATION_CREDENTIALS belum diisi di .env.local.\n" +
          "  Ambil service account key di Firebase Console > Project settings >\n" +
          "  Service accounts > Generate new private key, simpan di LUAR folder repo,\n" +
          "  lalu isi jalurnya di .env.local.",
      );
    }
    try {
      const kunci = JSON.parse(readFileSync(jalur, "utf8"));
      initializeApp({ credential: cert(kunci), projectId: kunci.project_id });
    } catch (e) {
      berhenti(`Gagal membaca service account key di ${jalur}\n  ${(e as Error).message}`);
    }
  }
  return getFirestore();
}

/* ── Prompt ─────────────────────────────────────────────────────────────── */

/* ── Menjalankan Claude Code ────────────────────────────────────────────── */

interface HasilClaude {
  result?: string;
  is_error?: boolean;
}

/** Menjalankan Claude Code dan mengembalikan array hasilnya.
 *
 *  Prompt dikirim lewat stdin, bukan sebagai argumen baris perintah. Dua
 *  alasannya sama-sama pernah menggigit: argumen sepanjang beberapa kilobyte
 *  mendekati batas ARG_MAX pada konteks portofolio yang besar, dan yang lebih
 *  menyakitkan, pesan galat execFile menggemakan SELURUH perintah, sehingga
 *  alasan kegagalan yang sebenarnya terdorong keluar dari batas pemotongan dan
 *  yang tersimpan cuma potongan prompt sendiri.
 *
 *  WebSearch dan WebFetch harus diizinkan eksplisit. Sesi non-interaktif tidak
 *  bisa memunculkan dialog izin, jadi tanpa flag ini Claude tidak punya akses
 *  data terkini sama sekali dan, dengan benar, menolak mengarang: yang keluar
 *  adalah array kosong terus-menerus. Daftarnya sengaja dibatasi pada alat baca;
 *  script ini tidak perlu menyentuh berkas atau menjalankan perintah apa pun. */
export async function tanyaClaude(prompt: string): Promise<unknown[]> {
  const stdout = await new Promise<string>((selesai, tolak) => {
    const anak = spawn(
      "claude",
      ["-p", "--output-format", "json", "--allowedTools", "WebSearch", "WebFetch"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let keluar = "";
    let galat = "";
    let sudah = false;

    const jam = setTimeout(() => {
      anak.kill("SIGKILL");
      habis(new Error(`Claude tidak selesai dalam ${Math.round(BATAS_WAKTU_MS / 60000)} menit.`));
    }, BATAS_WAKTU_MS);

    function habis(e: Error | null, hasil?: string) {
      if (sudah) return;
      sudah = true;
      clearTimeout(jam);
      if (e) tolak(e);
      else selesai(hasil!);
    }

    anak.stdout.on("data", (d) => { keluar += d; });
    anak.stderr.on("data", (d) => { galat += d; });
    anak.on("error", (e) =>
      habis(new Error(`Tidak bisa menjalankan perintah "claude": ${e.message}`)));

    anak.on("close", (kode, sinyal) => {
      if (kode === 0) return habis(null, keluar);
      // Yang dilaporkan adalah stderr dan sinyalnya, bukan perintahnya. Sinyal
      // SIGKILL di sini hampir selalu berarti sistem kehabisan memori dan
      // mematikan prosesnya, bukan Claude yang bermasalah.
      const sebab =
        sinyal === "SIGKILL"
          ? "prosesnya dimatikan sistem, biasanya karena memori habis"
          : (galat.trim() || keluar.trim() || "tanpa pesan").slice(0, 300);
      habis(new Error(`claude keluar dengan kode ${kode}${sinyal ? ` (${sinyal})` : ""}: ${sebab}`));
    });

    anak.stdin.end(prompt);
  });

  const amplop = JSON.parse(stdout) as HasilClaude;
  if (amplop.is_error) throw new Error(`Claude membalas dengan galat: ${amplop.result ?? "(tanpa pesan)"}`);
  if (!amplop.result) throw new Error("Claude tidak mengembalikan isi apa pun.");

  // Model kadang membungkus JSON dengan pagar kode meskipun diminta tidak.
  // Mengambil kurung terluar lebih tahan banting daripada berharap patuh.
  const teks = amplop.result.trim();
  const mulai = teks.indexOf("[");
  const akhir = teks.lastIndexOf("]");
  if (mulai === -1 || akhir <= mulai) {
    throw new Error(`Balasan bukan array JSON: ${teks.slice(0, 200)}`);
  }
  const isi = JSON.parse(teks.slice(mulai, akhir + 1));
  if (!Array.isArray(isi)) throw new Error("Balasan bukan array.");
  return isi;
}

/* ── Validasi ───────────────────────────────────────────────────────────── */

const REKOMENDASI = new Set(["beli", "tahan", "jual", "pantau"]);

/** Menyaring keluaran model sebelum disimpan.
 *
 *  Model bisa saja mengembalikan bentuk yang tidak sesuai kontrak, dan kalau
 *  itu lolos ke Firestore, yang rusak bukan cuma satu kartu di layar tapi
 *  seluruh perhitungan R:R yang membacanya. Baris yang tidak lolos dibuang,
 *  tidak diperbaiki diam-diam. */
export function sahkan(mentah: unknown, uid: string, tanggal: string) {
  if (typeof mentah !== "object" || mentah === null) return null;
  const r = mentah as Record<string, unknown>;

  const ticker = typeof r.ticker === "string" ? r.ticker.trim().toUpperCase() : "";
  const rekomendasi = typeof r.rekomendasi === "string" ? r.rekomendasi.toLowerCase() : "";
  if (!ticker || !REKOMENDASI.has(rekomendasi)) return null;

  const angka = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
  const entry = angka(r.suggestedEntry);
  const stop = angka(r.suggestedStop);
  const target = angka(r.suggestedTarget);

  // Aturan 3: rekomendasi yang menyuruh bertindak wajib punya angka lengkap
  // dengan R:R minimal 1,5. Tanpa stop, tidak ada yang bisa dinilai belakangan.
  if (rekomendasi === "beli" || rekomendasi === "jual") {
    if (entry === undefined || stop === undefined || target === undefined) return null;
    if (entry === stop) return null;
    const risiko = Math.abs(entry - stop);
    const imbalan = Math.abs(target - entry);
    const arahBenar = stop < entry ? target > entry : target < entry;
    if (!arahBenar || imbalan / risiko < 1.5) return null;
  }

  const dok: Record<string, unknown> = {
    uid,
    ticker,
    jenisAset: r.jenisAset === "kripto" ? "kripto" : "saham",
    tanggal,
    sumber: "claude-code",
    rekomendasi,
    catatanTeknikal: typeof r.technicalNotes === "string" ? r.technicalNotes : "",
    catatanFundamental: typeof r.fundamentalNotes === "string" ? r.fundamentalNotes : "",
    mataUang: r.mataUang === "IDR" ? "IDR" : "USD",
    status: "menunggu",
    dibuatPada: Date.now(),
  };
  if (entry !== undefined) dok.entrySaran = entry;
  if (stop !== undefined) dok.stopSaran = stop;
  if (target !== undefined) dok.targetSaran = target;
  return dok;
}

/* ── Loop utama ─────────────────────────────────────────────────────────── */

async function kerjakan(db: Firestore, id: string, p: PermintaanRiset) {
  const ref = db.collection(KOLEKSI_PERMINTAAN).doc(id);
  console.log(`\n  Permintaan ${id.slice(0, 8)} diambil, menganalisis…`);
  await ref.update({ status: "diproses", diprosesPada: Date.now() });

  try {
    const mentah = await tanyaClaude(susunPrompt(p.konteks));
    const sah = mentah
      .map((m) => sahkan(m, p.uid, p.tanggal))
      .filter((x): x is Record<string, unknown> => x !== null)
      .slice(0, MAKS_SARAN);

    const dibuang = mentah.length - sah.length;
    for (const dok of sah) await db.collection(KOLEKSI_SARAN).add(dok);

    await ref.update({
      status: "selesai", selesaiPada: Date.now(), jumlahSaran: sah.length,
    });
    console.log(
      `  Selesai: ${sah.length} saran tersimpan` +
        (dibuang > 0 ? `, ${dibuang} dibuang karena tidak lolos validasi` : "") +
        (sah.length === 0 ? " (tidak ada yang dinilai layak, dan itu jawaban yang sah)" : ""),
    );
  } catch (e) {
    const pesan = (e as Error).message.slice(0, 400);
    await ref.update({ status: "gagal", selesaiPada: Date.now(), pesanGagal: pesan });
    console.error(`  Gagal: ${pesan}`);
  }
}

function jalan() {
  const db = mulaiAdmin();
  const sedang = new Set<string>();

  console.log("\n  Watcher riset Nakhoda hidup.");
  console.log("  Menunggu permintaan dari app. Tekan Ctrl+C untuk berhenti.\n");

  db.collection(KOLEKSI_PERMINTAAN)
    .where("status", "==", "menunggu")
    .onSnapshot(
      (cuplikan) => {
        for (const d of cuplikan.docs) {
          if (sedang.has(d.id)) continue;
          sedang.add(d.id);
          void kerjakan(db, d.id, d.data() as PermintaanRiset).finally(() => sedang.delete(d.id));
        }
      },
      (e) => console.error("  Langganan Firestore putus:", e.message),
    );
}

/* Dijalankan hanya kalau berkas ini yang dipanggil langsung, bukan saat
   fungsinya diimpor untuk diuji. */
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  jalan();
}
