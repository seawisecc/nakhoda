"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type PilihanTema = "gelap" | "terang" | "sistem";

const KUNCI = "nakhoda:tema";

/* Skrip ini disuntikkan ke <head> dan berjalan sebelum React sempat merender.
 * Tanpa itu, halaman berkedip putih sekejap sebelum tema gelap terpasang, dan
 * kedipan itu paling menyakitkan justru di app yang temanya gelap. */
export const SKRIP_TEMA = `
(function(){
  try {
    var p = localStorage.getItem(${JSON.stringify(KUNCI)});
    if (p === "terang") document.documentElement.setAttribute("data-theme","light");
    else if (p !== "sistem") document.documentElement.setAttribute("data-theme","dark");
  } catch (e) {
    document.documentElement.setAttribute("data-theme","dark");
  }
})();
`.trim();

/* Preferensi tema dan preferensi sistem sama-sama hidup di luar React, jadi
 * keduanya dibaca lewat useSyncExternalStore. Membacanya lewat useEffect lalu
 * setState akan membuat render pertama selalu memakai tema yang salah, lalu
 * memperbaikinya di render kedua, dan pergantian itu terlihat. */

const pelangganTema = new Set<() => void>();

function bacaTersimpan(): PilihanTema {
  try {
    const p = localStorage.getItem(KUNCI);
    return p === "terang" || p === "sistem" ? p : "gelap";
  } catch {
    // localStorage melempar di mode penyamaran sebagian browser.
    return "gelap";
  }
}

function berlanggananTema(cb: () => void): () => void {
  pelangganTema.add(cb);
  // Tab lain yang mengganti tema ikut memberi kabar lewat event storage.
  window.addEventListener("storage", cb);
  return () => {
    pelangganTema.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function berlanggananSistem(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const bacaSistem = (): "gelap" | "terang" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang";

// Snapshot server harus cocok dengan yang dipasang SKRIP_TEMA saat tidak ada
// preferensi tersimpan, kalau tidak hidrasi akan bertengkar dengan atribut
// yang sudah ada di <html>.
const gelapDiServer = () => "gelap" as const;

interface IsiTema {
  pilihan: PilihanTema;
  /** Tema yang benar-benar tampil, setelah "sistem" diterjemahkan. */
  aktif: "gelap" | "terang";
  setTema: (p: PilihanTema) => void;
}

const Konteks = createContext<IsiTema | null>(null);

function terapkan(p: PilihanTema) {
  const el = document.documentElement;
  if (p === "sistem") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", p === "gelap" ? "dark" : "light");
}

export function PenyediaTema({ children }: { children: React.ReactNode }) {
  const pilihan = useSyncExternalStore(berlanggananTema, bacaTersimpan, gelapDiServer);
  const sistem = useSyncExternalStore(berlanggananSistem, bacaSistem, gelapDiServer);

  const setTema = useCallback((p: PilihanTema) => {
    try {
      localStorage.setItem(KUNCI, p);
    } catch {
      // Menyimpan preferensi boleh gagal; menerapkannya tidak boleh.
    }
    // Transisi warna hanya dinyalakan saat pengguna benar-benar menekan tombol
    // tema, lalu dimatikan lagi. Kalau dibiarkan menyala, setiap perpindahan
    // halaman ikut memudar dan app terasa lamban.
    const el = document.documentElement;
    el.setAttribute("data-transisi-tema", "");
    terapkan(p);
    window.setTimeout(() => el.removeAttribute("data-transisi-tema"), 260);
    for (const cb of pelangganTema) cb();
  }, []);

  const nilai = useMemo<IsiTema>(
    () => ({ pilihan, aktif: pilihan === "sistem" ? sistem : pilihan, setTema }),
    [pilihan, sistem, setTema],
  );

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function useTema(): IsiTema {
  const isi = useContext(Konteks);
  if (!isi) throw new Error("useTema harus dipakai di dalam <PenyediaTema>");
  return isi;
}
