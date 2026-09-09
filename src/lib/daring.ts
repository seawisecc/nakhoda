"use client";

import { useSyncExternalStore } from "react";

function berlangganan(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

const ambil = () => navigator.onLine;
// Di server tidak ada gagasan "luring". Menjawab true membuat render server
// dan render klien pertama sama untuk kasus yang jauh lebih umum.
const ambilServer = () => true;

/** Status koneksi sebagai sumber data eksternal. */
export function useDaring(): boolean {
  return useSyncExternalStore(berlangganan, ambil, ambilServer);
}
