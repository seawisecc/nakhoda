import { bacaAngka, formatPersen, formatQty, formatUang } from "@/lib/format";
import {
  akhirBulan, awalBulan, formatTanggal, hariAntara, selangWaktu, tambahHari,
} from "@/lib/tanggal";
import { simbolTradingView } from "@/components/tradingview";
import { grup, uji, samaDengan, benar } from "./uji";

grup("format uang", () => {
  uji("rupiah tanpa sen", () => samaDengan(formatUang(1_250_000, "IDR"), "Rp 1.250.000"));
  uji("dolar dengan sen", () => samaDengan(formatUang(228.45, "USD"), "$228,45"));
  uji("minus di depan simbol, bukan setelahnya", () =>
    samaDengan(formatUang(-1_250_000, "IDR"), "-Rp 1.250.000"));
  uji("minus di depan simbol juga saat diringkas", () =>
    samaDengan(formatUang(-126_300_000, "IDR", { ringkas: true }), "-Rp 126,3 jt"));
  uji("minus untuk dolar", () => samaDengan(formatUang(-12.5, "USD"), "-$12,50"));
  uji("ringkas rupiah ke jutaan", () => samaDengan(formatUang(128_450_000, "IDR", { ringkas: true }), "Rp 128,5 jt"));
  uji("ringkas rupiah ke miliar", () => samaDengan(formatUang(1_250_000_000, "IDR", { ringkas: true }), "Rp 1,25 M"));
  uji("angka kecil tidak diringkas paksa", () => samaDengan(formatUang(500, "IDR", { ringkas: true }), "Rp 500"));
  uji("bukan angka jadi tanda hubung", () => samaDengan(formatUang(NaN, "IDR"), "—"));
});

grup("format lain", () => {
  uji("persen positif diberi tanda plus", () => samaDengan(formatPersen(6.25), "+6,25%"));
  uji("persen negatif apa adanya", () => samaDengan(formatPersen(-3.5), "-3,50%"));
  uji("qty pecahan kecil pakai banyak desimal", () => samaDengan(formatQty(0.00012345), "0,00012345"));
  uji("qty besar dibulatkan", () => samaDengan(formatQty(1234.5678), "1.234,57"));
});

grup("bacaAngka", () => {
  uji("format Indonesia penuh", () => samaDengan(bacaAngka("1.250.000,5"), 1250000.5));
  uji("koma sebagai desimal", () => samaDengan(bacaAngka("228,45"), 228.45));
  uji("titik sebagai desimal gaya inggris", () => samaDengan(bacaAngka("228.45"), 228.45));
  uji("titik sebagai ribuan", () => samaDengan(bacaAngka("1.250"), 1250));
  uji("titik ribuan berlapis", () => samaDengan(bacaAngka("1.250.000"), 1250000));
  uji("teks kosong bukan angka", () => benar(Number.isNaN(bacaAngka(""))));
  uji("teks sembarang bukan angka", () => benar(Number.isNaN(bacaAngka("abc"))));
});

grup("tanggal", () => {
  uji("selisih hari", () => samaDengan(hariAntara("2026-09-01", "2026-09-30"), 29));
  uji("selisih lintas bulan", () => samaDengan(hariAntara("2026-08-25", "2026-09-02"), 8));
  uji("awal bulan", () => samaDengan(awalBulan("2026-09-14"), "2026-09-01"));
  uji("akhir bulan Februari kabisat", () => samaDengan(akhirBulan("2028-02-10"), "2028-02-29"));
  uji("akhir bulan Februari biasa", () => samaDengan(akhirBulan("2026-02-10"), "2026-02-28"));
  uji("tambah hari lintas tahun", () => samaDengan(tambahHari("2026-12-31", 1), "2027-01-01"));
  uji("format tanggal Indonesia", () => samaDengan(formatTanggal("2026-09-05", "panjang"), "5 September 2026"));
  uji("selang waktu jam", () => samaDengan(selangWaktu(0, 3 * 3600_000), "3 jam lalu"));
  uji("selang waktu baru", () => samaDengan(selangWaktu(0, 10_000), "baru saja"));
});

grup("simbol TradingView", () => {
  uji("saham dilepas apa adanya", () => samaDengan(simbolTradingView("nvda", "saham"), "NVDA"));
  uji("kripto jadi pasangan Binance", () =>
    samaDengan(simbolTradingView("btc", "kripto"), "BINANCE:BTCUSDT"));
  uji("stablecoin pakai simbol indeks", () =>
    samaDengan(simbolTradingView("USDT", "kripto"), "CRYPTO:USDTUSD"));
  uji("simbol lengkap tidak diutak-atik", () =>
    samaDengan(simbolTradingView("NASDAQ:NVDA", "saham"), "NASDAQ:NVDA"));
  uji("ticker kosong menghasilkan string kosong", () =>
    samaDengan(simbolTradingView("  ", "kripto"), ""));
});
