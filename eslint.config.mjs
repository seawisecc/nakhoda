import vitals from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

/* eslint-config-next 16 sudah berbentuk flat config. Membungkusnya lewat
 * FlatCompat justru gagal: paket lama itu mencoba men-serialize konfigurasi
 * yang punya rujukan melingkar. */
const config = [
  ...vitals,
  ...ts,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/sw.js"] },
];

export default config;
