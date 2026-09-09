import { bacaAngkaBebas, uraiSaran } from "@/lib/hitung/urai-saran";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const cari = (h: ReturnType<typeof uraiSaran>, t: string) => h.baris.find((b) => b.ticker === t);

grup("bacaAngkaBebas", () => {
  uji("titik desimal gaya inggris", () => samaDengan(bacaAngkaBebas("228.45"), 228.45));
  uji("koma desimal gaya Indonesia", () => samaDengan(bacaAngkaBebas("228,45"), 228.45));
  uji("ribuan bertitik", () => samaDengan(bacaAngkaBebas("1.978"), 1978));
  uji("ribuan berkoma", () => samaDengan(bacaAngkaBebas("79,700"), 79700));
  uji("campuran penuh gaya Indonesia", () => samaDengan(bacaAngkaBebas("1.510.162.854"), 1510162854));
  uji("campuran penuh gaya inggris", () => samaDengan(bacaAngkaBebas("1,978.36"), 1978.36));
  uji("simbol mata uang diabaikan", () => samaDengan(bacaAngkaBebas("$228.45"), 228.45));
  uji("rupiah diabaikan", () => samaDengan(bacaAngkaBebas("Rp 1.250.000"), 1250000));
  uji("teks tanpa angka mengembalikan null", () => samaDengan(bacaAngkaBebas("tidak ada"), null));
});

grup("urai JSON", () => {
  uji("array JSON dibaca lengkap", () => {
    const h = uraiSaran(`Berikut hasilnya:
\`\`\`json
[{"ticker":"NVDA","rekomendasi":"beli","entry":228.45,"stop":210,"target":265}]
\`\`\``);
    const n = cari(h, "NVDA")!;
    samaDengan(n.rekomendasi, "beli");
    samaDengan(n.entry, 228.45);
    samaDengan(n.stop, 210);
    samaDengan(n.target, 265);
    samaDengan(n.hilang.length, 0);
  });

  uji("nama field gaya inggris juga dikenali", () => {
    const h = uraiSaran('[{"symbol":"AAPL","action":"sell","entryPrice":"230.5","stopLoss":"240","takeProfit":"200"}]');
    const a = cari(h, "AAPL")!;
    samaDengan(a.entry, 230.5);
    samaDengan(a.stop, 240);
    samaDengan(a.rekomendasi, "jual");
  });
});

grup("urai tabel markdown", () => {
  const teks = `
| Ticker | Rekomendasi | Entry | Stop Loss | Target |
|--------|-------------|-------|-----------|--------|
| NVDA   | Buy         | 228.45| 210       | 265    |
| BTC    | Sell        | 79,700| 84,000    | 70,000 |
`;
  uji("kolom dipetakan dari judulnya", () => {
    const h = uraiSaran(teks);
    samaDengan(h.baris.length, 2);
    const n = cari(h, "NVDA")!;
    samaDengan(n.entry, 228.45);
    samaDengan(n.stop, 210);
    samaDengan(n.rekomendasi, "beli");
  });
  uji("ribuan berkoma di tabel terbaca benar", () => {
    const b = cari(uraiSaran(teks), "BTC")!;
    samaDengan(b.entry, 79700);
    samaDengan(b.target, 70000);
    samaDengan(b.rekomendasi, "jual");
  });
  uji("baris pemisah tabel tidak jadi saran", () => {
    benar(!uraiSaran(teks).baris.some((b) => /^-+$/.test(b.ticker)));
  });
  uji("kripto dikenali dari tickernya", () => {
    samaDengan(cari(uraiSaran(teks), "BTC")!.jenisAset, "kripto");
    samaDengan(cari(uraiSaran(teks), "NVDA")!.jenisAset, "saham");
  });
});

grup("urai teks bebas", () => {
  uji("paragraf gaya AI dengan label Indonesia", () => {
    const h = uraiSaran(`
**NVDA** — Rekomendasi: Beli
Entry: 228,45
Stop loss: 210
Target: 265
Alasan: breakout dari konsolidasi tiga minggu dengan volume konfirmasi.
`);
    const n = cari(h, "NVDA")!;
    samaDengan(n.rekomendasi, "beli");
    samaDengan(n.entry, 228.45);
    samaDengan(n.stop, 210);
    samaDengan(n.target, 265);
    benar(n.catatan.includes("breakout"), "catatan harus ikut terbawa");
  });

  uji("dua ticker di dua paragraf jadi dua baris", () => {
    const h = uraiSaran(`
GOOG: buy at 335.31, stop 322, target 360. Support kuat.

MELI: hold. Belum ada higher-low.
`);
    samaDengan(h.baris.length, 2);
    samaDengan(cari(h, "GOOG")!.entry, 335.31);
    samaDengan(cari(h, "MELI")!.rekomendasi, "tahan");
  });

  uji("field yang tidak ada dicatat sebagai hilang, bukan ditebak", () => {
    const m = cari(uraiSaran("MELI: hold. Belum ada higher-low."), "MELI")!;
    samaDengan(m.entry, null);
    samaDengan(m.stop, null);
    benar(m.hilang.includes("entry") && m.hilang.includes("stop"));
  });

  uji("kata seperti RSI dan MACD tidak dianggap ticker", () => {
    const h = uraiSaran("NVDA kuat. RSI 58, MACD positif, MA50 di atas MA200. Entry: 228");
    samaDengan(h.baris.length, 1);
    samaDengan(h.baris[0].ticker, "NVDA");
  });

  uji("BUY dan SELL tidak dianggap ticker", () => {
    const h = uraiSaran("BUY KMI di 31.40, SL 29.80, TP 34.80");
    samaDengan(h.baris.length, 1);
    samaDengan(h.baris[0].ticker, "KMI");
    samaDengan(h.baris[0].stop, 29.8);
    samaDengan(h.baris[0].target, 34.8);
  });

  uji("angka diambil setelah labelnya, bukan sebelum", () => {
    // "turun 12% lalu target 70000": target harus 70000, bukan 12.
    const b = cari(uraiSaran("BTC bisa turun 12% dari sini. Target: 70000. Stop: 84000."), "BTC")!;
    samaDengan(b.target, 70000);
    samaDengan(b.stop, 84000);
  });

  uji("mata uang rupiah dikenali", () => {
    const b = cari(uraiSaran("BTC entry Rp 1.400.000.000, stop Rp 1.300.000.000"), "BTC")!;
    samaDengan(b.mataUang, "IDR");
    samaDengan(b.entry, 1400000000);
  });

  uji("ticker yang disebut dua kali digabung, bukan digandakan", () => {
    const h = uraiSaran(`
| Ticker | Entry | Stop | Target |
|---|---|---|---|
| NVDA | 228.45 | 210 | 265 |

NVDA: rekomendasi beli. Alasannya backlog data center masih penuh.
`);
    samaDengan(h.baris.length, 1);
    const n = h.baris[0];
    samaDengan(n.entry, 228.45);
    samaDengan(n.rekomendasi, "beli");
    benar(n.catatan.includes("backlog"), "catatan dari paragraf harus ikut");
  });

  uji("teks tanpa ticker sama sekali dilaporkan sebagai tak terbaca", () => {
    const h = uraiSaran("Secara umum pasar sedang tidak menentu dan sebaiknya menunggu dulu sampai ada kejelasan arah.");
    samaDengan(h.baris.length, 0);
    samaDengan(h.takTerbaca.length, 1);
  });

  uji("teks kosong tidak melempar", () => {
    const h = uraiSaran("   ");
    samaDengan(h.baris.length, 0);
    samaDengan(h.takTerbaca.length, 0);
  });
});

grup("urai, kasus dunia nyata", () => {
  uji("keluaran gaya ChatGPT dengan heading dan bullet", () => {
    const h = uraiSaran(`
## Rekomendasi Portofolio

### 1. GOOG (Alphabet)
- **Aksi**: BUY
- **Entry**: $335.31
- **Stop Loss**: $322.00
- **Target**: $360.00
- **R:R**: 1.85
- Analisis: menguji konfluensi support, AVWAP year-to-date.

### 2. MELI (MercadoLibre)
- **Aksi**: HOLD
- Masih tren turun, belum membentuk higher-low.
`);
    samaDengan(h.baris.length, 2);
    const g = cari(h, "GOOG")!;
    mendekati(g.entry!, 335.31);
    mendekati(g.stop!, 322);
    samaDengan(g.rekomendasi, "beli");
    samaDengan(cari(h, "MELI")!.rekomendasi, "tahan");
  });
});
