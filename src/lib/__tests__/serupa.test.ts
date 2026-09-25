import { cariSerupa, PANJANG_SERUPA } from "@/lib/hitung/serupa";
import type { Lilin } from "@/lib/hitung/sinyal";
import { grup, uji, samaDengan, benar, mendekati } from "./uji";

const dariHarga = (harga: number[]): Lilin[] =>
  harga.map((h, i) => ({ tanggal: `t${String(i).padStart(4, "0")}`, buka: h, tinggi: h, rendah: h, tutup: h }));

function acak(n: number, benih = 5): number[] {
  let x = benih;
  let h = 100;
  return Array.from({ length: n }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    h *= 1 + (x / 2147483648 - 0.5) * 0.06;
    return h;
  });
}

grup("pola serupa", () => {
  uji("potongan lama yang bentuknya sama persis ditemukan, walau harganya dua kali lipat", () => {
    const h = acak(400);
    // 20 sesi terakhir adalah salinan sesi 100 sampai 119, dikali dua.
    const deret = [...h, ...h.slice(100, 120).map((x) => x * 2)];
    const s = cariSerupa(dariHarga(deret))!;
    samaDengan(s.cocok[0].akhir, 119);
    mendekati(s.cocok[0].korelasi, 1, 1e-9);
  });

  uji("kecocokan tidak saling tumpang tindih dan tidak menyentuh potongan acuan", () => {
    const s = cariSerupa(dariHarga(acak(2500, 9)), { korelasiMin: 0.5 })!;
    benar(s.cocok.length > 1, "harus ada beberapa kecocokan");
    for (const a of s.cocok) {
      benar(a.akhir < s.acuanDari, "berakhir sebelum acuan");
      for (const c of s.cocok) if (c !== a) benar(Math.abs(a.akhir - c.akhir) >= PANJANG_SERUPA, "tumpang tindih");
    }
  });

  uji("diurut dari yang paling mirip, dan semuanya di atas batas korelasi", () => {
    const s = cariSerupa(dariHarga(acak(2500, 3)))!;
    for (let k = 1; k < s.cocok.length; k += 1) benar(s.cocok[k - 1].korelasi >= s.cocok[k].korelasi);
    benar(s.cocok.every((c) => c.korelasi >= 0.8));
  });

  uji("paling banyak lima belas", () => {
    samaDengan(cariSerupa(dariHarga(acak(3000, 4)), { korelasiMin: -1 })!.cocok.length, 15);
  });

  uji("data terlalu pendek atau acuan yang datar tidak menghasilkan apa-apa", () => {
    samaDengan(cariSerupa(dariHarga(acak(50))), null);
    samaDengan(cariSerupa(dariHarga([...acak(200), ...Array(20).fill(100)])), null);
  });
});
