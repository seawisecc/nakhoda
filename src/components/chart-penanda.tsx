"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries, ColorType, LineSeries, LineStyle, createChart, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time,
} from "lightweight-charts";

export interface BatangChart {
  tanggal: string;
  buka: number;
  tinggi: number;
  rendah: number;
  tutup: number;
}

export interface PenandaChart {
  /** Tanggal sesi tempat penanda ditaruh, harus ada di `batang`. */
  tanggal: string;
  teks: string;
  /** Tanda yang mengklaim arah digambar di sisi arahnya: panah naik di
   *  bawah lilin, panah turun di atasnya. Bentuk panahnya yang membawa
   *  arah, warnanya cuma penguat. Tanpa arah (aspek planet), penandanya
   *  netral di atas lilin. */
  arah?: "naik" | "turun";
  /** Warna yang menggantikan warna arah. Dipakai saat teksnya adalah hasil
   *  kejadian: panah tetap menunjuk klaim pola, warnanya mengikuti apa yang
   *  benar-benar terjadi. Tanpa itu, pola turun yang gagal tampil sebagai
   *  "+9,1%" berwarna merah, dan angka naik bertinta rugi. */
  warna?: "naik" | "turun" | "netral";
}

export interface GarisChart {
  titik: { tanggal: string; harga: number }[];
  putus?: boolean;
  /** Disorot penuh, atau diredupkan karena bentuk lain yang sedang dipilih. */
  redup?: boolean;
}

/** Warna token dibaca dari CSS lalu dinormalkan lewat peramban.
 *
 *  Kanvas tidak mengerti var(), dan pengurai warna lightweight-charts tidak
 *  mengerti sintaks rgb() berspasi yang dipakai beberapa token. Menaruh
 *  warnanya di elemen sementara membuat peramban sendiri yang
 *  menerjemahkannya ke bentuk rgba() berkoma yang pasti terbaca. */
function bacaWarna(token: string): string {
  const el = document.createElement("span");
  el.style.color = `var(${token})`;
  document.body.appendChild(el);
  const warna = getComputedStyle(el).color;
  el.remove();
  return warna;
}

function pasangData(
  c: IChartApi | null, s: ISeriesApi<"Candlestick"> | null, b: BatangChart[], lebar: number,
) {
  if (!c || !s) return;
  s.setData(
    b.map((x) => ({ time: x.tanggal as Time, open: x.buka, high: x.tinggi, low: x.rendah, close: x.tutup })),
  );
  // Dua tahun terakhir sebagai tampilan awal, dan sembilan bulan di layar
  // ponsel. Satu dekade penuh membuat lilinnya setipis rambut dan
  // penandanya saling menumpuk; di lebar 390px, dua tahun sudah begitu.
  const jumlah = lebar > 0 && lebar < 520 ? 180 : 500;
  if (b.length > jumlah) c.timeScale().setVisibleLogicalRange({ from: b.length - jumlah, to: b.length + 5 });
  else c.timeScale().fitContent();
}

interface WarnaPenanda { netral: string; naik: string; turun: string }

function pasangPenanda(t: ISeriesMarkersPluginApi<Time> | null, warna: WarnaPenanda, p: PenandaChart[]) {
  t?.setMarkers(
    p.map((x) => ({
      time: x.tanggal as Time,
      position: x.arah === "naik" ? ("belowBar" as const) : ("aboveBar" as const),
      shape: x.arah === "naik" ? ("arrowUp" as const) : ("arrowDown" as const),
      color: warna[x.warna ?? x.arah ?? "netral"],
      text: x.teks,
    })),
  );
}

/** Garis bentuk digambar sebagai seri baris tersendiri, bukan di atas kanvas
 *  terpisah. Seri ikut sumbu waktu dan harga chart-nya, jadi garisnya tetap
 *  menempel di tempatnya saat chart digeser atau di-zoom; overlay yang
 *  digambar sendiri harus menghitung ulang posisinya di setiap gerakan dan
 *  selalu tertinggal satu frame.
 *
 *  Seri lama dibuang, bukan dipakai ulang: jumlah garis berubah setiap kali
 *  bentuk yang dipilih berganti. */
function pasangGaris(
  c: IChartApi | null,
  simpanan: { current: ISeriesApi<"Line">[] },
  warna: string,
  garis: GarisChart[],
) {
  if (!c) return;
  for (const s of simpanan.current) {
    try {
      c.removeSeries(s);
    } catch {
      // Seri sudah ikut terbuang saat chart dibangun ulang.
    }
  }
  simpanan.current = garis.map((g) => {
    const seri = c.addSeries(LineSeries, {
      color: warna,
      lineWidth: 2,
      lineStyle: g.putus ? LineStyle.Dashed : LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    seri.setData(g.titik.map((t) => ({ time: t.tanggal as Time, value: t.harga })));
    return seri;
  });
}

/** Chart lilin yang digambar sendiri, bukan widget TradingView. Dipakai
 *  tampilan Astro dan Sinyal.
 *
 *  Widget TradingView adalah iframe, dan tidak ada cara menaruh penanda di
 *  dalamnya. lightweight-charts (juga buatan TradingView, open source)
 *  memberi kanvas yang bisa ditandai, tapi tanpa RSI dan kawan-kawan.
 *  Karena itu keduanya hidup berdampingan, bukan saling menggantikan.
 *
 *  Chart, data, dan penanda dipasang di tiga efek terpisah. Menyatukannya
 *  berarti membangun ulang chart setiap kali satu penanda berubah, dan
 *  zoom yang sudah diatur ikut hilang. */
export function ChartPenanda({
  batang, penanda, garis = [], tema,
}: {
  batang: BatangChart[];
  penanda: PenandaChart[];
  /** Garis bentuk: tren, leher pola, level mendatar. */
  garis?: GarisChart[];
  tema: string;
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const seri = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const tanda = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const seriGaris = useRef<ISeriesApi<"Line">[]>([]);
  const warnaTanda = useRef<WarnaPenanda>({ netral: "", naik: "", turun: "" });

  // Batang dan penanda dibaca dari ref saat chart dibangun ulang karena tema,
  // supaya efek tema tidak perlu bergantung pada keduanya.
  const batangKini = useRef(batang);
  const penandaKini = useRef(penanda);
  const garisKini = useRef(garis);
  useEffect(() => {
    batangKini.current = batang;
    penandaKini.current = penanda;
    garisKini.current = garis;
  });

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const tinta = bacaWarna("--nk-ink-faint");
    const garis = bacaWarna("--nk-grid");
    const tepi = bacaWarna("--nk-border");
    const naik = bacaWarna("--nk-naik");
    const turun = bacaWarna("--nk-turun");
    warnaTanda.current = { netral: bacaWarna("--nk-info"), naik, turun };
    const huruf = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();

    const c = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tinta,
        fontFamily: huruf || "monospace",
        fontSize: 11,
      },
      grid: { vertLines: { color: garis }, horzLines: { color: garis } },
      rightPriceScale: { borderColor: tepi },
      timeScale: { borderColor: tepi },
      crosshair: { mode: 0 },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: naik, downColor: turun,
      wickUpColor: naik, wickDownColor: turun,
      borderVisible: false,
    });
    chart.current = c;
    seri.current = s;
    tanda.current = createSeriesMarkers(s, []);
    pasangData(c, s, batangKini.current, el.clientWidth);
    pasangPenanda(tanda.current, warnaTanda.current, penandaKini.current);
    pasangGaris(c, seriGaris, warnaTanda.current.netral, garisKini.current);

    return () => {
      seriGaris.current = [];
      c.remove();
      chart.current = null;
      seri.current = null;
      tanda.current = null;
    };
  }, [tema]);

  useEffect(() => {
    pasangData(chart.current, seri.current, batang, wadah.current?.clientWidth ?? 0);
  }, [batang]);
  useEffect(() => { pasangPenanda(tanda.current, warnaTanda.current, penanda); }, [penanda]);
  useEffect(() => {
    pasangGaris(chart.current, seriGaris, warnaTanda.current.netral, garis);
  }, [garis]);

  return <div ref={wadah} className="size-full" />;
}
