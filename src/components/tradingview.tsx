"use client";

import { useEffect, useRef } from "react";
import type { JenisAset } from "@/types";

/** Stablecoin tidak punya pasangan terhadap dirinya sendiri di bursa mana pun,
 *  jadi keduanya memakai simbol indeks TradingView, bukan pasangan Binance. */
const KRIPTO_INDEKS = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD"]);

/** Simbol TradingView dari ticker biasa.
 *
 *  Saham AS dilepas apa adanya; TradingView sendiri yang memilih bursanya.
 *
 *  Kripto dipetakan ke pasangan Binance terhadap USDT. Awalnya ini memakai
 *  `CRYPTO:BTCUSD`, dan simbol itu memang ada tapi mengembalikan chart kosong.
 *  Pasangan bursa sungguhan punya riwayat penuh, dan Binance melistkan
 *  hampir semua koin yang mungkin dipegang. Kalau ada yang tidak cocok,
 *  widget-nya sendiri mengizinkan ganti simbol lewat kolom pencariannya.
 *
 *  Ticker yang sudah memuat titik dua ("NASDAQ:NVDA") dianggap sudah lengkap
 *  dan dilewatkan apa adanya. */
export function simbolTradingView(ticker: string, jenisAset: JenisAset): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return "";
  if (t.includes(":")) return t;
  if (jenisAset !== "kripto") return t;
  return KRIPTO_INDEKS.has(t) ? `CRYPTO:${t}USD` : `BINANCE:${t}USDT`;
}

/** Widget Advanced Chart TradingView.
 *
 *  Ini iframe pihak ketiga, dan itu memang pilihan sadar: membangun ulang
 *  RSI, MACD, dan puluhan indikator lain bukan pekerjaan yang sepadan untuk
 *  app satu pengguna. Konsekuensinya diterima: tampilannya tidak bisa
 *  dikustomisasi penuh dan bergantung pada uptime TradingView.
 *
 *  Widget tidak punya API untuk mengganti tema atau simbol setelah dipasang,
 *  jadi wadahnya dibongkar dan dibangun ulang saat salah satunya berubah. */
export function ChartTradingView({
  simbol, tema, tinggi = 560,
}: {
  simbol: string;
  tema: "gelap" | "terang";
  /** Angka piksel, atau string CSS seperti "100%" untuk mengisi induknya. */
  tinggi?: number | string;
}) {
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wadah.current;
    if (!el || !simbol) return;

    el.innerHTML = "";
    const kotak = document.createElement("div");
    kotak.className = "tradingview-widget-container__widget";
    kotak.style.height = "100%";
    el.appendChild(kotak);

    const skrip = document.createElement("script");
    skrip.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    skrip.type = "text/javascript";
    skrip.async = true;
    skrip.innerHTML = JSON.stringify({
      autosize: true,
      symbol: simbol,
      interval: "D",
      timezone: "Asia/Jakarta",
      theme: tema === "gelap" ? "dark" : "light",
      style: "1",
      locale: "id",
      backgroundColor: tema === "gelap" ? "#171512" : "#fffdf8",
      gridColor: tema === "gelap" ? "rgba(255,255,255,0.06)" : "rgba(35,32,27,0.07)",
      allow_symbol_change: true,
      withdateranges: true,
      hide_side_toolbar: false,
      details: false,
      studies: ["STD;RSI", "STD;MACD"],
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(skrip);

    return () => {
      el.innerHTML = "";
    };
  }, [simbol, tema]);

  // Tinggi dipasang di pembungkus luar, bukan di kontainer widget.
  // Skrip TradingView menimpa style.height kontainernya sendiri jadi "100%",
  // dan persentase itu butuh induk yang punya tinggi nyata. Tanpa pembungkus
  // ini, chart kolaps jadi 150 piksel bawaan iframe.
  return (
    <div
      className="overflow-hidden border border-bordr"
      style={{ height: tinggi }}
    >
      <div ref={wadah} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
