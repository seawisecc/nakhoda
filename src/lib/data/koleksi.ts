/** Nama koleksi Firestore.
 *
 *  Nama di sisi kode berbahasa Indonesia, nama di Firestore berbahasa Inggris.
 *  Yang di Firestore adalah kontrak dengan script Claude Code
 *  (scripts/tambah-saran.ts) dan dengan security rules, jadi tidak boleh
 *  berubah sembarangan. */
export const KOLEKSI = {
  transaksi: "transactions",
  arusModal: "capitalFlows",
  jurnal: "journalEntries",
  saran: "suggestions",
  alokasi: "allocationPlans",
  hargaCache: "priceCache",
  kursCache: "fxCache",
  snapshot: "snapshots",
  pengaturan: "settings",
} as const;

export type NamaKoleksi = keyof typeof KOLEKSI;

/** Koleksi yang berisi banyak dokumen per pengguna. `pengaturan` sengaja tidak
 *  masuk: dia satu dokumen tunggal beralamat uid, bukan kumpulan. */
export const KOLEKSI_DOKUMEN = [
  "transaksi", "arusModal", "jurnal", "saran", "alokasi", "snapshot", "hargaCache",
  "kursCache",
] as const satisfies readonly NamaKoleksi[];

export type KoleksiDokumen = (typeof KOLEKSI_DOKUMEN)[number];
