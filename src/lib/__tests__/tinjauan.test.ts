import { susunTinjauan, type InputTinjauan } from "@/lib/hitung/tinjauan";
import type { JurnalEntri, Posisi } from "@/types";
import { hitungBiaya, turunkanTarif } from "@/lib/hitung/biaya";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const kurs = { usdIdr: 16_000 };

function posisi(p: Partial<Posisi>): Posisi {
  return {
    ticker: "NVDA", jenisAset: "saham", mataUang: "USD", qty: 10, avgHarga: 100,
    biayaTotal: 1000, labaTerealisasi: 0, feeTotal: 0, jumlahTransaksi: 1,
    tanggalPertama: "2026-01-01", tanggalTerakhir: "2026-01-01",
    campurMataUang: false, ...p,
  };
}
function jrn(e: Partial<JurnalEntri>): JurnalEntri {
  return {
    id: "j1", uid: "u", ticker: "NVDA", jenisAset: "saham", tanggal: "2026-01-01",
    mataUang: "USD", thesisTeknikal: "", thesisFundamental: "",
    hargaEntry: 100, stopLoss: 90, targetHarga: 130, status: "terbuka",
    dibuatPada: 1, ...e,
  };
}
function dasar(x: Partial<InputTinjauan> = {}): InputTinjauan {
  return {
    posisi: [], jurnal: [],
    ringkasan: {
      mataUang: "IDR", nilaiPosisi: 0, kas: 0, totalNilai: 10_000_000,
      modalBersih: 10_000_000, totalSetor: 10_000_000, totalTarik: 0,
      labaBelumTerealisasi: 0, labaTerealisasi: 0, labaTotal: 0, labaTotalPersen: 0,
      alokasi: { saham: 0, kripto: 0, kas: 0 }, posisiTanpaHarga: 0,
    },
    dietz: {
      persen: 1, bmv: 10_000_000, emv: 10_100_000, arusBersih: 0,
      modalRata: 10_000_000, bmvPerkiraan: false,
      mulai: "2026-09-01", akhir: "2026-09-20", hari: 19,
    },
    targetMin: 3, targetMaks: 10, risikoPerTrade: 1, kurs, ...x,
  };
}
const cari = (t: ReturnType<typeof susunTinjauan>, id: string) => t.find((x) => x.id === id);

grup("tinjauan", () => {
  uji("stop yang sudah terlampaui jadi temuan paling atas", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ hargaTerakhir: 85 })],
      jurnal: [jrn({ stopLoss: 90 })],
    }));
    samaDengan(t[0].id, "stop-j1");
    samaDengan(t[0].nada, "bahaya");
  });

  uji("target yang tercapai dikenali sebagai peluang, bukan bahaya", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ hargaTerakhir: 135 })],
      jurnal: [jrn({ targetHarga: 130 })],
    }));
    samaDengan(cari(t, "target-j1")!.nada, "peluang");
    samaDengan(cari(t, "stop-j1"), undefined);
  });

  uji("posisi short: stop di atas entry dibaca dengan arah yang benar", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ hargaTerakhir: 115 })],
      jurnal: [jrn({ hargaEntry: 100, stopLoss: 110, targetHarga: 80 })],
    }));
    benar(cari(t, "stop-j1"), "stop short harusnya kena di harga naik");
  });

  uji("jurnal yang sudah ditutup diabaikan", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ hargaTerakhir: 85 })],
      jurnal: [jrn({ status: "tertutup", hasil: "rugi", hargaKeluar: 90 })],
    }));
    samaDengan(cari(t, "stop-j1"), undefined);
  });

  uji("posisi tanpa harga tidak menghasilkan temuan stop palsu", () => {
    const t = susunTinjauan(dasar({ posisi: [posisi({})], jurnal: [jrn({})] }));
    samaDengan(cari(t, "stop-j1"), undefined);
  });

  uji("posisi tanpa jurnal terbuka ditandai belum punya rencana keluar", () => {
    const t = susunTinjauan(dasar({ posisi: [posisi({ ticker: "BTC" })] }));
    benar(cari(t, "tanpa-rencana")!.penjelasan.includes("BTC"));
  });

  uji("konsentrasi di atas seperempat portofolio disebut", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ mataUang: "IDR", nilaiPasar: 4_000_000, biayaTotal: 4_000_000 })],
    }));
    const k = cari(t, "konsentrasi-NVDA")!;
    mendekati(k.nilai!, 40);
  });

  uji("konsentrasi di bawah ambang tidak disebut", () => {
    const t = susunTinjauan(dasar({
      posisi: [posisi({ mataUang: "IDR", nilaiPasar: 2_000_000, biayaTotal: 2_000_000 })],
    }));
    samaDengan(cari(t, "konsentrasi-NVDA"), undefined);
  });

  uji("kas menganggur besar disebut, kas kecil tidak", () => {
    const banyak = dasar();
    banyak.ringkasan = { ...banyak.ringkasan, kas: 5_000_000 };
    benar(cari(susunTinjauan(banyak), "kas-nganggur"));

    const sedikit = dasar();
    sedikit.ringkasan = { ...sedikit.ringkasan, kas: 1_000_000 };
    samaDengan(cari(susunTinjauan(sedikit), "kas-nganggur"), undefined);
  });

  uji("jarak ke target dihitung dalam rupiah atas nilai awal bulan", () => {
    // Capaian 1%, target minimum 3%, jadi kurang 2% dari BMV 10 juta = 200 ribu.
    const t = cari(susunTinjauan(dasar()), "jarak-target")!;
    mendekati(t.nilai!, 200_000);
  });

  uji("target yang sudah terlampaui tidak menuntut apa-apa", () => {
    const x = dasar();
    x.dietz = { ...x.dietz, persen: 5 };
    const t = susunTinjauan(x);
    benar(cari(t, "target-tercapai"));
    samaDengan(cari(t, "jarak-target"), undefined);
  });

  uji("return yang belum terdefinisi tidak menghasilkan temuan target", () => {
    const x = dasar();
    x.dietz = { ...x.dietz, persen: null };
    const t = susunTinjauan(x);
    samaDengan(cari(t, "jarak-target"), undefined);
    samaDengan(cari(t, "target-tercapai"), undefined);
  });

  uji("jatah risiko per trade dihitung dari total portofolio", () => {
    const t = cari(susunTinjauan(dasar({ risikoPerTrade: 1.5 })), "jatah-risiko")!;
    mendekati(t.nilai!, 150_000);
  });

  uji("portofolio kosong tidak melempar dan tidak mengarang temuan", () => {
    const x = dasar();
    x.ringkasan = { ...x.ringkasan, totalNilai: 0 };
    x.dietz = { ...x.dietz, persen: null, bmv: 0 };
    const t = susunTinjauan(x);
    benar(Array.isArray(t));
    samaDengan(t.length, 0);
  });
});

grup("biaya transaksi", () => {
  const p = {
    uid: "u", targetBulananMin: 3, targetBulananMax: 10, mataUangDasar: "IDR" as const,
    targetKekayaan: 1e9, kursManualUsdIdr: 16300, feePersenSaham: 0.35, feePersenKripto: 0.5,
  };

  uji("biaya saham dihitung dari tarif saham", () =>
    mendekati(hitungBiaya(1000, "saham", p), 3.5));
  uji("biaya kripto dihitung dari tarif kripto", () =>
    mendekati(hitungBiaya(1000, "kripto", p), 5));
  uji("nilai nol tidak menghasilkan biaya", () =>
    samaDengan(hitungBiaya(0, "saham", p), 0));
  uji("tarif negatif diperlakukan sebagai nol, bukan pengurang", () =>
    samaDengan(hitungBiaya(1000, "saham", { ...p, feePersenSaham: -1 }), 0));

  uji("tarif diturunkan dari pembelian nyata", () => {
    // Beli senilai 1.000.000, uang keluar 1.003.500 berarti tarifnya 0,35%.
    mendekati(turunkanTarif(1_000_000, 1_003_500)!, 0.35, 1e-9);
  });
  uji("tarif diturunkan dari penjualan nyata", () => {
    mendekati(turunkanTarif(1_000_000, 995_000)!, 0.5, 1e-9);
  });
  uji("selisih tak masuk akal ditolak, bukan dipakai", () =>
    samaDengan(turunkanTarif(1_000_000, 500_000), null));
  uji("angka nol ditolak", () => samaDengan(turunkanTarif(0, 100), null));
});
