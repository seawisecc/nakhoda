"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker untuk cangkang app.
 *
 *  Ini soal caching kode app supaya bisa dipasang ke layar utama dan dibuka
 *  saat luring. Sinkronisasi data sama sekali tidak lewat sini; itu sudah
 *  ditangani cache persisten Firestore. Dua hal yang sering tertukar. */
export function DaftarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      /* Di pengembangan, service worker tidak cukup hanya "tidak didaftarkan".
       *
       * Service worker terikat ke origin, bukan ke perintah yang menyalakannya.
       * Begitu `npm run build && npm start` pernah dijalankan sekali di
       * localhost:3000, SW-nya tetap terdaftar di origin itu, dan `npm run dev`
       * berikutnya di port yang sama akan dilayani olehnya.
       *
       * Itu bukan masalah kecil. sw.js menyajikan /_next/static/ cache-first,
       * dengan alasan yang benar untuk produksi: di sana nama berkasnya
       * ber-hash isi, jadi satu URL selalu berarti satu isi. Di dev, nama chunk
       * dipakai ulang lintas kompilasi, jadi aturan yang sama justru mengunci
       * bundel lama. Gejalanya paling menyesatkan yang ada: HTML-nya baru
       * (navigasi dilayani jaringan lebih dulu) sementara JS-nya lama, jadi
       * halaman tampil, data mengalir, tidak ada satu pun galat di konsol, dan
       * perubahan kode sama sekali tidak muncul. Reload biasa tidak menolong
       * karena reload biasa tetap lewat SW.
       *
       * Karena itu di dev SW-nya dibatalkan, bukan sekadar dilewati, dan
       * cache-nya ikut dihapus. */
      void (async () => {
        const terdaftar = await navigator.serviceWorker.getRegistrations();
        if (!terdaftar.length) return;
        await Promise.all(terdaftar.map((r) => r.unregister()));
        if ("caches" in window) {
          const kunci = await caches.keys();
          await Promise.all(kunci.map((k) => caches.delete(k)));
        }
        console.info(
          "[nakhoda] Service worker sisa dari build produksi dibatalkan, " +
            "cache-nya dihapus. Muat ulang sekali untuk memakai kode terbaru.",
        );
      })();
      return;
    }

    const daftar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Pendaftaran boleh gagal (mode penyamaran, izin dimatikan). App tetap
        // jalan penuh selama online, jadi tidak ada yang perlu dilaporkan.
      });
    };
    if (document.readyState === "complete") daftar();
    else window.addEventListener("load", daftar, { once: true });
  }, []);

  return null;
}
