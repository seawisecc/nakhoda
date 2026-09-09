"use client";

import { useEffect, useState } from "react";

/** Jam WIB di bilah atas.
 *
 *  Dibuat sebagai komponennya sendiri supaya yang dirender ulang tiap detik
 *  cuma satu <span>, bukan seluruh bilah atas beserta chip dan tombolnya.
 *
 *  Nilainya sengaja kosong sampai komponen terpasang. Waktu di server tidak
 *  pernah sama dengan waktu di browser, dan merender jam saat SSR menghasilkan
 *  ketidakcocokan hidrasi yang muncul persis satu kali di konsol lalu hilang,
 *  yaitu bentuk galat yang paling lama dicari. */
export function Jam({ className }: { className?: string }) {
  const [waktu, setWaktu] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const tik = () => setWaktu(format.format(new Date()));
    tik();

    // Disinkronkan ke pergantian detik, bukan ke interval 1000ms sejak
    // dipasang. Tanpa ini, jamnya melompat pada offset acak dan terlihat
    // tertinggal sampai satu detik dari jam sistem.
    let interval: number | undefined;
    const awal = window.setTimeout(() => {
      tik();
      interval = window.setInterval(tik, 1000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      window.clearTimeout(awal);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  if (waktu === null) return null;

  return (
    <span className={className}>
      {waktu} <span className="text-ink-faint">WIB</span>
    </span>
  );
}
