/* Menerbitkan firestore.rules ke project Firebase.
 *
 *   npm run deploy-rules
 *
 * Dijalankan lewat firebase-tools supaya tidak perlu membuka Console dan
 * menempel aturan dengan tangan, yang justru cara paling gampang menerbitkan
 * versi yang salah.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config as muatEnv } from "dotenv";

muatEnv({ path: ".env.local", quiet: true });

const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!project) {
  console.error("\n  NEXT_PUBLIC_FIREBASE_PROJECT_ID belum diisi di .env.local\n");
  process.exit(1);
}
if (!existsSync("firestore.rules")) {
  console.error("\n  firestore.rules tidak ditemukan\n");
  process.exit(1);
}

console.log(`\n  Menerbitkan aturan ke project ${project}\n`);
try {
  execSync(`npx firebase-tools deploy --only firestore:rules --project ${project}`, {
    stdio: "inherit",
  });
} catch {
  console.error(
    "\n  Gagal. Kalau ini pertama kali, jalankan dulu:\n" +
      "    npx firebase-tools login\n",
  );
  process.exit(1);
}
