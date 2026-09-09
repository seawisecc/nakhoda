"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { JenisAset, MataUang, Sisi, Transaksi } from "@/types";
import { useData, buatId } from "@/lib/data/penyedia";
import { usePortofolio } from "@/lib/data/portofolio";
import { bangunPosisi } from "@/lib/hitung/posisi";
import { KURS_CADANGAN } from "@/lib/hitung/uang";
import { hitungBiaya, tarifUntuk } from "@/lib/hitung/biaya";
import { bacaAngka, formatAngka, formatQty, formatUang } from "@/lib/format";
import { hariIni } from "@/lib/tanggal";
import { AreaTeks, Bidang, Isian, IsianAngka, Pilihan, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";

interface Isi {
  tanggal: string;
  ticker: string;
  jenisAset: JenisAset;
  sisi: Sisi;
  qty: string;
  harga: string;
  fee: string;
  mataUang: MataUang;
  catatan: string;
}

function isiAwal(t?: Transaksi | null): Isi {
  return {
    tanggal: t?.tanggal ?? hariIni(),
    ticker: t?.ticker ?? "",
    jenisAset: t?.jenisAset ?? "saham",
    sisi: t?.sisi ?? "beli",
    qty: t ? String(t.qty) : "",
    harga: t ? String(t.harga) : "",
    fee: t ? String(t.fee ?? 0) : "",
    mataUang: t?.mataUang ?? "USD",
    catatan: t?.catatan ?? "",
  };
}

/** Formulir transaksi.
 *
 *  Isinya dipisah ke komponen sendiri yang baru terpasang saat panel dibuka.
 *  Dengan begitu keadaan awal formulir lahir dari useState, bukan dari efek
 *  yang menyetel ulang state setiap kali panel dibuka. Bedanya terasa: cara
 *  lama merender satu putaran dengan isi formulir yang lama sebelum
 *  menimpanya, dan isian yang berkedip seperti itu terlihat jelas. */
export function FormTransaksi({
  terbuka, tutup, sunting,
}: {
  terbuka: boolean;
  tutup: () => void;
  sunting?: Transaksi | null;
}) {
  return (
    <Panel
      terbuka={terbuka}
      tutup={tutup}
      judul={sunting ? "Ubah transaksi" : "Catat transaksi"}
      keterangan="Posisi dan biaya rata-rata dihitung ulang otomatis dari seluruh riwayat transaksi."
    >
      <IsiFormTransaksi key={sunting?.id ?? "baru"} tutup={tutup} sunting={sunting} />
    </Panel>
  );
}

function IsiFormTransaksi({
  tutup, sunting,
}: {
  tutup: () => void;
  sunting?: Transaksi | null;
}) {
  const { simpan, transaksi, pengguna, pengaturan } = useData();
  // Harga pasar hanya menempel di posisi yang sudah dinilai; bangunPosisi
  // sendiri cuma menghitung qty dan basis biaya.
  const { posisiAktif: posisiBerharga } = usePortofolio();
  const [isi, setIsi] = useState<Isi>(() => isiAwal(sunting));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  /* Fee berhenti diisi otomatis begitu disentuh sendiri. Angka yang terus
     ditimpa app setelah diperbaiki tangan adalah cara tercepat membuat orang
     berhenti percaya pada isian otomatis.

     Transaksi yang SEDANG DISUNTING selalu dihitung manual, termasuk yang
     fee-nya nol. Kalau tidak, membuka transaksi lama lalu menyimpannya tanpa
     mengubah apa pun akan diam-diam memasang fee baru dari tarif hari ini, dan
     basis biaya seluruh posisi ikut bergeser tanpa ada yang menyadarinya. */
  const [feeManual, setFeeManual] = useState(Boolean(sunting));

  const ubah = <K extends keyof Isi>(k: K, v: Isi[K]) =>
    setIsi((s) => ({ ...s, [k]: v }));

  const qty = bacaAngka(isi.qty);
  const harga = bacaAngka(isi.harga);

  /* Fee dihitung dari tarif di Pengaturan selama pengguna belum mengetiknya
     sendiri. Fee yang dibiarkan nol diam-diam akan menggeser basis biaya dan
     setiap angka laba yang lahir darinya. */
  const nilaiKotor = Number.isFinite(qty) && Number.isFinite(harga) ? qty * harga : 0;
  const feeOtomatis = hitungBiaya(nilaiKotor, isi.jenisAset, pengaturan);
  const feeTampil = feeManual ? isi.fee : feeOtomatis > 0 ? String(Number(feeOtomatis.toFixed(6))) : "";
  const fee = feeManual ? (isi.fee.trim() ? bacaAngka(isi.fee) : 0) : feeOtomatis;
  const total = Number.isFinite(qty) && Number.isFinite(harga)
    ? nilaiKotor + (isi.sisi === "beli" ? (Number.isFinite(fee) ? fee : 0) : -(Number.isFinite(fee) ? fee : 0))
    : NaN;

  /** Posisi yang benar-benar dipegang. Transaksi yang sedang disunting
   *  dikeluarkan supaya mengedit qty jual tidak salah dianggap kelebihan. */
  const posisiDipegang = useMemo(() => {
    const lain = sunting ? transaksi.filter((t) => t.id !== sunting.id) : transaksi;
    return bangunPosisi(lain, KURS_CADANGAN)
      .filter((p) => p.qty > 0)
      .map((p) => ({
        ...p,
        // Qty datang dari perhitungan yang mengecualikan transaksi yang sedang
        // disunting; harganya diambil dari posisi yang sudah dinilai pasar.
        hargaTerakhir: posisiBerharga.find((x) => x.ticker === p.ticker)?.hargaTerakhir,
      }));
  }, [transaksi, sunting, posisiBerharga]);

  const dipegang = useMemo(() => {
    const ticker = isi.ticker.trim().toUpperCase();
    if (!ticker) return null;
    return posisiDipegang.find((x) => x.ticker === ticker)?.qty ?? 0;
  }, [isi.ticker, posisiDipegang]);

  const jualBerlebih =
    isi.sisi === "jual" && dipegang !== null && Number.isFinite(qty) && qty > dipegang + 1e-9;

  function periksa(): boolean {
    const g: Record<string, string> = {};
    if (!isi.ticker.trim()) g.ticker = "Ticker wajib diisi.";
    if (!isi.tanggal) g.tanggal = "Tanggal wajib diisi.";
    if (!Number.isFinite(qty) || qty <= 0) g.qty = "Jumlah harus lebih dari nol.";
    if (!Number.isFinite(harga) || harga <= 0) g.harga = "Harga harus lebih dari nol.";
    if (isi.fee.trim() && (!Number.isFinite(fee) || fee < 0)) g.fee = "Fee tidak boleh negatif.";
    setGalat(g);
    return Object.keys(g).length === 0;
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!periksa()) return;
    setSibuk(true);
    try {
      const dok: Transaksi = {
        id: sunting?.id ?? buatId(),
        uid: pengguna?.uid ?? "lokal",
        ticker: isi.ticker.trim().toUpperCase(),
        jenisAset: isi.jenisAset,
        sisi: isi.sisi,
        tanggal: isi.tanggal,
        qty,
        harga,
        fee: Number.isFinite(fee) ? fee : 0,
        mataUang: isi.mataUang,
        catatan: isi.catatan.trim() || undefined,
        dibuatPada: sunting?.dibuatPada ?? Date.now(),
      };
      // Firestore menolak nilai undefined, dan `catatan` yang dikosongkan akan
      // mengirim undefined kalau tidak dibuang lebih dulu.
      if (!dok.catatan) delete dok.catatan;
      await simpan("transaksi", dok);
      tutup();
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Tanggal" wajib galat={galat.tanggal}>
            <Isian
              type="date"
              value={isi.tanggal}
              max={hariIni()}
              onChange={(e) => ubah("tanggal", e.target.value)}
            />
          </Bidang>
          {/* Menjual hanya bisa dari yang benar-benar dipegang, jadi tidak ada
              gunanya meminta ticker diketik ulang. Memilih dari daftar juga
              sekalian menetapkan jenis aset dan mata uangnya dengan benar,
              yang kalau diketik tangan gampang tidak cocok dengan posisinya. */}
          {isi.sisi === "jual" && posisiDipegang.length ? (
            <Bidang label="Aset yang dijual" wajib galat={galat.ticker}>
              <Pilihan
                value={isi.ticker}
                onChange={(e) => {
                  const p = posisiDipegang.find((x) => x.ticker === e.target.value);
                  setIsi((s) => ({
                    ...s,
                    ticker: e.target.value,
                    jenisAset: p?.jenisAset ?? s.jenisAset,
                    mataUang: p?.mataUang ?? s.mataUang,
                    // Harga terakhir dipakai sebagai titik awal, bukan
                    // keputusan: harga jual sebenarnya tetap harus diisi dari
                    // konfirmasi broker.
                    harga: p?.hargaTerakhir ? String(Number(p.hargaTerakhir.toPrecision(10))) : s.harga,
                  }));
                }}
              >
                <option value="">Pilih aset</option>
                {posisiDipegang.map((p) => (
                  <option key={p.ticker} value={p.ticker}>
                    {p.ticker} · {formatQty(p.qty)} unit
                  </option>
                ))}
              </Pilihan>
            </Bidang>
          ) : (
            <Bidang label="Ticker" wajib galat={galat.ticker}>
              <Isian
                value={isi.ticker}
                onChange={(e) => ubah("ticker", e.target.value.toUpperCase())}
                placeholder="NVDA"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Bidang>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Jenis aset">
            <Pilihan
              value={isi.jenisAset}
              onChange={(e) => {
                const j = e.target.value as JenisAset;
                ubah("jenisAset", j);
              }}
            >
              <option value="saham">Saham AS</option>
              <option value="kripto">Kripto</option>
            </Pilihan>
          </Bidang>
          <Bidang label="Aksi">
            <Pilihan
              value={isi.sisi}
              onChange={(e) => {
                const sisi = e.target.value as Sisi;
                setIsi((s) => {
                  const punya = posisiDipegang.some((p) => p.ticker === s.ticker);
                  // Kalau ticker yang sedang diketik tidak ada di kepemilikan,
                  // daftar pilihan akan menampilkan nilai yang tidak ada di
                  // dalamnya dan terlihat kosong tanpa penjelasan.
                  return { ...s, sisi, ticker: sisi === "jual" && !punya ? "" : s.ticker };
                });
              }}
            >
              <option value="beli">Beli</option>
              <option value="jual">Jual</option>
            </Pilihan>
          </Bidang>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Bidang
            label="Jumlah unit"
            wajib
            galat={galat.qty}
            petunjuk={
              isi.sisi === "jual" && dipegang !== null
                ? `Dipegang saat ini: ${formatQty(dipegang)}`
                : "Boleh pecahan, mis. 0,0125"
            }
          >
            <IsianAngka
              value={isi.qty}
              onChange={(e) => ubah("qty", e.target.value)}
              placeholder="0,0125"
            />
            {/* Menjual selalu dibatasi kepemilikan nyata, dan pecahan seperti
                0,00493508 ETH mustahil diketik ulang tanpa salah. Tombol porsi
                mengambil angkanya dari posisi, bukan dari ingatan. */}
            {isi.sisi === "jual" && dipegang !== null && dipegang > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  [0.25, "25%"],
                  [0.5, "50%"],
                  [0.75, "75%"],
                  [1, "Jual semua"],
                ] as const).map(([f, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      // Porsi penuh memakai angka kepemilikan apa adanya supaya
                      // tidak menyisakan debu pecahan yang tak bisa dijual.
                      const n = f === 1 ? dipegang : dipegang * f;
                      ubah("qty", String(Number(n.toPrecision(12))));
                    }}
                    className="border border-bordr px-2.5 py-1 text-[12px] text-ink-faint transition hover:border-aksen/40 hover:text-aksen"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </Bidang>
          <Bidang label="Harga per unit" wajib galat={galat.harga}>
            <IsianAngka
              value={isi.harga}
              onChange={(e) => ubah("harga", e.target.value)}
              placeholder="228,45"
            />
          </Bidang>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Bidang
            label="Fee"
            galat={galat.fee}
            petunjuk={
              feeManual
                ? "Diisi tangan. Kosongkan untuk kembali ke hitungan otomatis."
                : `Otomatis ${formatAngka(tarifUntuk(isi.jenisAset, pengaturan), 2)}% dari nilai transaksi, sesuai Pengaturan.`
            }
          >
            <IsianAngka
              value={feeTampil}
              onChange={(e) => {
                const v = e.target.value;
                setFeeManual(v.trim() !== "");
                ubah("fee", v);
              }}
              placeholder="0"
            />
          </Bidang>
          <Bidang label="Mata uang" petunjuk="Mata uang harga di atas.">
            <Pilihan
              value={isi.mataUang}
              onChange={(e) => ubah("mataUang", e.target.value as MataUang)}
            >
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </Pilihan>
          </Bidang>
        </div>

        {Number.isFinite(total) ? (
          <div className="border border-bordr bg-surface-sunk px-3.5 py-3">
            <div className="flex items-baseline justify-between text-[13px] text-ink-faint">
              <span>Nilai transaksi</span>
              <span className="angka">{formatUang(nilaiKotor, isi.mataUang)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[13px] text-ink-faint">
              <span>Fee</span>
              <span className="angka">
                {isi.sisi === "beli" ? "+" : "-"}
                {formatUang(Number.isFinite(fee) ? fee : 0, isi.mataUang)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-bordr pt-2">
              <span className="text-[13px] text-ink-soft">
                {isi.sisi === "beli" ? "Total keluar" : "Total masuk"}
              </span>
              <span className="angka text-[15px] font-semibold text-ink">
                {formatUang(total, isi.mataUang)}
              </span>
            </div>
          </div>
        ) : null}

        {jualBerlebih ? (
          <p className="flex items-start gap-2 border border-peringatan/30 bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-peringatan">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Jumlah yang dijual melebihi {formatQty(dipegang ?? 0)} unit yang tercatat. Nakhoda tetap
            menyimpannya, tapi kelebihan itu akan dihitung tanpa basis biaya, jadi laba terealisasi
            akan terlihat lebih besar dari seharusnya.
          </p>
        ) : null}

        <Bidang label="Catatan" petunjuk="Opsional. Alasan singkat, atau dari broker mana.">
          <AreaTeks
            value={isi.catatan}
            onChange={(e) => ubah("catatan", e.target.value)}
            rows={2}
            className="min-h-16"
          />
        </Bidang>

        <KakiPanel>
          <Tombol type="button" rupa="hantu" onClick={tutup}>Batal</Tombol>
          <Tombol type="submit" rupa="utama" disabled={sibuk}>
            {sibuk ? "Menyimpan" : sunting ? "Simpan perubahan" : "Simpan transaksi"}
          </Tombol>
      </KakiPanel>
    </form>
  );
}
