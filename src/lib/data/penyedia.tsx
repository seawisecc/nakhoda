"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type {
  ArusModal, HargaCache, JurnalEntri, KursCache, ModeData, Pengaturan,
  Saran, Snapshot, Transaksi,
} from "@/types";
import {
  KOLEKSI, KOLEKSI_DOKUMEN, type KoleksiDokumen, type NamaKoleksi,
} from "./koleksi";
import { ambilLokal, hapusSemuaLokal, tulisLokal, useKoleksiLokal } from "./lokal";
import { ambilAuth, ambilDb, konfigurasiAda } from "@/lib/firebase/klien";

export const PENGATURAN_AWAL: Pengaturan = {
  uid: "lokal",
  targetBulananMin: 3,
  targetBulananMax: 10,
  mataUangDasar: "IDR",
  targetKekayaan: 1_000_000_000,
  kursManualUsdIdr: 16_300,
  // Angka awal, BUKAN angka resmi Pluang. Nakhoda tidak punya cara memastikan
  // tarif broker siapa pun, dan menebak diam-diam berarti setiap laba yang
  // ditampilkan meleset tanpa ada yang tahu. Halaman Pengaturan menyediakan
  // penghitung untuk menurunkan tarif sebenarnya dari satu transaksi nyata.
  feePersenSaham: 0.35,
  feePersenKripto: 0.5,
};

interface Pengguna {
  uid: string;
  email: string | null;
}

interface IsiData {
  mode: ModeData;
  siap: boolean;
  pengguna: Pengguna | null;
  galatAuth: string | null;

  transaksi: Transaksi[];
  arusModal: ArusModal[];
  jurnal: JurnalEntri[];
  saran: Saran[];
  snapshot: Snapshot[];
  hargaCache: HargaCache[];
  kursCache: KursCache[];
  pengaturan: Pengaturan;

  masuk: (email: string, sandi: string) => Promise<void>;
  keluar: () => Promise<void>;

  simpan: <T extends { id: string }>(koleksi: NamaKoleksi, dok: T) => Promise<void>;
  hapus: (koleksi: NamaKoleksi, id: string) => Promise<void>;
  simpanPengaturan: (ubah: Partial<Pengaturan>) => Promise<void>;
  /** Menghapus seluruh data pengguna. Hanya dipakai dari Pengaturan. */
  bersihkanSemua: () => Promise<void>;
}

const Konteks = createContext<IsiData | null>(null);

export function buatId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type PetaDokumen = Record<KoleksiDokumen, { id: string }[]>;

const KOSONG_FIRESTORE: PetaDokumen = {
  transaksi: [], arusModal: [], jurnal: [], saran: [],
  snapshot: [], hargaCache: [], kursCache: [],
};

export function PenyediaData({ children }: { children: React.ReactNode }) {
  const mode: ModeData = konfigurasiAda ? "firestore" : "lokal";
  const lokal = mode === "lokal";

  const [pengguna, setPengguna] = useState<Pengguna | null>(
    lokal ? { uid: "lokal", email: null } : null,
  );
  const [siapAuth, setSiapAuth] = useState(lokal);
  const [galatAuth, setGalatAuth] = useState<string | null>(null);
  const [siapFirestore, setSiapFirestore] = useState(false);

  // Dua sumber data yang saling meniadakan: mode lokal membaca localStorage
  // sebagai sumber eksternal, mode Firestore menerima dorongan dari onSnapshot.
  const [dariFirestore, setDariFirestore] = useState<PetaDokumen>(KOSONG_FIRESTORE);
  const [pengaturanFirestore, setPengaturanFirestore] = useState<Pengaturan>(PENGATURAN_AWAL);

  const transaksiLokal = useKoleksiLokal<Transaksi>("transaksi", lokal);
  const arusLokal = useKoleksiLokal<ArusModal>("arusModal", lokal);
  const jurnalLokal = useKoleksiLokal<JurnalEntri>("jurnal", lokal);
  const saranLokal = useKoleksiLokal<Saran>("saran", lokal);
  const snapshotLokal = useKoleksiLokal<Snapshot>("snapshot", lokal);
  const hargaLokal = useKoleksiLokal<HargaCache>("hargaCache", lokal);
  const kursLokal = useKoleksiLokal<KursCache>("kursCache", lokal);
  const pengaturanLokal = useKoleksiLokal<Pengaturan>("pengaturan", lokal);

  /* ── Autentikasi ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (lokal) return;
    let lepas: (() => void) | null = null;
    let dibatalkan = false;

    void (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      if (dibatalkan) return;
      lepas = onAuthStateChanged(ambilAuth(), (u) => {
        setPengguna(u ? { uid: u.uid, email: u.email } : null);
        setSiapAuth(true);
      });
    })();

    return () => {
      dibatalkan = true;
      lepas?.();
    };
  }, [lokal]);

  const masuk = useCallback(async (email: string, sandi: string) => {
    setGalatAuth(null);
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    try {
      await signInWithEmailAndPassword(ambilAuth(), email.trim(), sandi);
    } catch (e) {
      const kode = (e as { code?: string }).code ?? "";
      setGalatAuth(
        kode.includes("invalid-credential") || kode.includes("wrong-password")
          ? "Email atau kata sandi tidak cocok."
          : kode.includes("too-many-requests")
            ? "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
            : kode.includes("network")
              ? "Tidak bisa menghubungi Firebase. Periksa koneksi."
              : "Gagal masuk. Periksa email dan kata sandi.",
      );
      throw e;
    }
  }, []);

  const keluar = useCallback(async () => {
    const { signOut } = await import("firebase/auth");
    await signOut(ambilAuth());
  }, []);

  /* ── Langganan Firestore ────────────────────────────────────────────── */

  useEffect(() => {
    // Data sisa dari pengguna sebelumnya tidak perlu dibersihkan di sini:
    // nilai yang dibagikan ke bawah sudah mengabaikan `dariFirestore` selama
    // belum ada pengguna, jadi keluar akun langsung mengosongkan tampilan.
    if (lokal || !pengguna) return;
    const uid = pengguna.uid;
    const lepasSemua: Array<() => void> = [];
    let dibatalkan = false;

    void (async () => {
      const { collection, doc, onSnapshot, query, where } = await import("firebase/firestore");
      if (dibatalkan) return;
      const db = ambilDb();

      for (const nama of KOLEKSI_DOKUMEN) {
        const q = query(collection(db, KOLEKSI[nama]), where("uid", "==", uid));
        lepasSemua.push(
          onSnapshot(
            q,
            (cuplikan) => {
              const baris = cuplikan.docs.map((d) => ({ ...(d.data() as object), id: d.id }));
              setDariFirestore((s) => ({ ...s, [nama]: baris }));
              setSiapFirestore(true);
            },
            // Kegagalan langganan (aturan keamanan menolak, jaringan mati)
            // tidak boleh membuat app menggantung di layar memuat selamanya.
            () => setSiapFirestore(true),
          ),
        );
      }

      lepasSemua.push(
        onSnapshot(doc(db, KOLEKSI.pengaturan, uid), (d) => {
          setPengaturanFirestore(
            d.exists()
              ? { ...PENGATURAN_AWAL, ...(d.data() as Pengaturan), uid }
              : { ...PENGATURAN_AWAL, uid },
          );
        }),
      );
    })();

    return () => {
      dibatalkan = true;
      for (const l of lepasSemua) l();
    };
  }, [lokal, pengguna]);

  /* ── Menulis data ───────────────────────────────────────────────────── */

  const simpan = useCallback(
    async <T extends { id: string }>(koleksi: NamaKoleksi, dok: T) => {
      const uid = pengguna?.uid ?? "lokal";
      const isi = { ...dok, uid };

      if (lokal) {
        // Isi terkini dibaca langsung dari penyimpanan, bukan dari state React,
        // supaya dua penyimpanan beruntun dalam satu putaran tidak saling
        // menimpa karena keduanya membaca snapshot yang sama.
        const sekarang = ambilLokal<{ id: string }>(koleksi);
        const ada = sekarang.some((r) => r.id === dok.id);
        tulisLokal(
          koleksi,
          ada ? sekarang.map((r) => (r.id === dok.id ? isi : r)) : [...sekarang, isi],
        );
        return;
      }

      const { doc, setDoc } = await import("firebase/firestore");
      // Firestore menyimpan id sebagai nama dokumen, bukan sebagai field.
      const { id: _, ...tanpaId } = isi;
      void _;
      await setDoc(doc(ambilDb(), KOLEKSI[koleksi], dok.id), tanpaId, { merge: true });
    },
    [lokal, pengguna],
  );

  const hapus = useCallback(
    async (koleksi: NamaKoleksi, id: string) => {
      if (lokal) {
        tulisLokal(koleksi, ambilLokal<{ id: string }>(koleksi).filter((r) => r.id !== id));
        return;
      }
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(ambilDb(), KOLEKSI[koleksi], id));
    },
    [lokal],
  );

  const pengaturan = useMemo<Pengaturan>(() => {
    if (!lokal) return pengaturanFirestore;
    const p = pengaturanLokal[0];
    return p ? { ...PENGATURAN_AWAL, ...p } : PENGATURAN_AWAL;
  }, [lokal, pengaturanLokal, pengaturanFirestore]);

  const simpanPengaturan = useCallback(
    async (ubah: Partial<Pengaturan>) => {
      const uid = pengguna?.uid ?? "lokal";
      const baru = { ...pengaturan, ...ubah, uid };
      if (lokal) {
        tulisLokal("pengaturan", [baru]);
        return;
      }
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(ambilDb(), KOLEKSI.pengaturan, uid), baru, { merge: true });
    },
    [lokal, pengaturan, pengguna],
  );

  const bersihkanSemua = useCallback(async () => {
    if (lokal) {
      hapusSemuaLokal();
      return;
    }
    if (!pengguna) return;
    const { collection, deleteDoc, doc, getDocs, query, where, writeBatch } =
      await import("firebase/firestore");
    const db = ambilDb();
    for (const nama of KOLEKSI_DOKUMEN) {
      // Dokumen diambil langsung dari server, bukan dari state, supaya baris
      // yang belum sempat sampai ke langganan tetap ikut terhapus.
      const cuplikan = await getDocs(
        query(collection(db, KOLEKSI[nama]), where("uid", "==", pengguna.uid)),
      );
      const dokumen = cuplikan.docs;
      // Firestore membatasi 500 operasi per batch.
      for (let i = 0; i < dokumen.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of dokumen.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, KOLEKSI.pengaturan, pengguna.uid));
  }, [lokal, pengguna]);

  const nilai = useMemo<IsiData>(() => {
    const dok: PetaDokumen = lokal
      ? {
          transaksi: transaksiLokal, arusModal: arusLokal, jurnal: jurnalLokal,
          saran: saranLokal, snapshot: snapshotLokal, hargaCache: hargaLokal,
          kursCache: kursLokal,
        }
      : pengguna
        ? dariFirestore
        : KOSONG_FIRESTORE;

    return {
      mode,
      // Di mode lokal data selalu siap: pembacaannya sinkron. Di mode Firestore
      // baru siap setelah status auth diketahui dan, kalau sudah masuk,
      // langganan pertama sudah membalas.
      siap: lokal ? true : siapAuth && (!pengguna || siapFirestore),
      pengguna,
      galatAuth,
      transaksi: dok.transaksi as Transaksi[],
      arusModal: dok.arusModal as ArusModal[],
      jurnal: dok.jurnal as JurnalEntri[],
      saran: dok.saran as Saran[],
      snapshot: dok.snapshot as Snapshot[],
      hargaCache: dok.hargaCache as HargaCache[],
      kursCache: dok.kursCache as KursCache[],
      pengaturan,
      masuk, keluar, simpan, hapus, simpanPengaturan, bersihkanSemua,
    };
  }, [
    mode, lokal, siapAuth, siapFirestore, pengguna, galatAuth, dariFirestore,
    transaksiLokal, arusLokal, jurnalLokal, saranLokal, snapshotLokal,
    hargaLokal, kursLokal, pengaturan, masuk, keluar, simpan, hapus,
    simpanPengaturan, bersihkanSemua,
  ]);

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function useData(): IsiData {
  const isi = useContext(Konteks);
  if (!isi) throw new Error("useData harus dipakai di dalam <PenyediaData>");
  return isi;
}
