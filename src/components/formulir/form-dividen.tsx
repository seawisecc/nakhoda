"use client";

import { useState } from "react";
import type { Dividen, JenisAset, MataUang, Posisi } from "@/types";
import { useData, buatId } from "@/lib/data/penyedia";
import { bersihDividen } from "@/lib/hitung/dividen";
import { bacaAngka, formatUang } from "@/lib/format";
import { hariIni } from "@/lib/tanggal";
import { AreaTeks, Bidang, Isian, IsianAngka, Pilihan, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";

export function FormDividen({
  terbuka, tutup, sunting, posisi,
}: {
  terbuka: boolean;
  tutup: () => void;
  sunting?: Dividen | null;
  posisi: readonly Posisi[];
}) {
  return (
    <Panel
      terbuka={terbuka}
      tutup={tutup}
      judul={sunting ? "Ubah dividen" : "Catat dividen"}
      keterangan="Dividen masuk ke kas sebagai laba, bukan sebagai setoran modal. Itu yang membuat dia menaikkan return bulanan, bukan menekannya."
    >
      <IsiFormDividen
        key={sunting?.id ?? "baru"}
        tutup={tutup}
        sunting={sunting}
        posisi={posisi}
      />
    </Panel>
  );
}

function IsiFormDividen({
  tutup, sunting, posisi,
}: {
  tutup: () => void;
  sunting?: Dividen | null;
  posisi: readonly Posisi[];
}) {
  const { simpan, pengguna } = useData();
  const [ticker, setTicker] = useState(sunting?.ticker ?? "");
  const [jenisAset, setJenisAset] = useState<JenisAset>(sunting?.jenisAset ?? "saham");
  const [tanggal, setTanggal] = useState(sunting?.tanggal ?? hariIni());
  const [kotor, setKotor] = useState(sunting ? String(sunting.jumlahKotor) : "");
  const [pajak, setPajak] = useState(sunting ? String(sunting.pajak) : "");
  const [perUnit, setPerUnit] = useState(sunting?.perUnit ? String(sunting.perUnit) : "");
  const [mataUang, setMataUang] = useState<MataUang>(sunting?.mataUang ?? "USD");
  const [catatan, setCatatan] = useState(sunting?.catatan ?? "");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);

  const nKotor = bacaAngka(kotor);
  // Pajak kosong berarti nol, dan itu perbedaan yang sengaja dibiarkan: kolom
  // yang dikosongkan adalah pernyataan "tidak ada potongan", bukan tebakan.
  const nPajak = pajak.trim() ? bacaAngka(pajak) : 0;
  const bersih = bersihDividen({ jumlahKotor: nKotor, pajak: nPajak });

  /** Memilih ticker dari posisi yang dipegang sekaligus mengikutkan kelas aset
   *  dan mata uangnya, supaya dividen dolar tidak pernah masuk berlabel
   *  rupiah hanya karena kolomnya terlewat diubah. */
  function pilihPosisi(t: string) {
    setTicker(t);
    const p = posisi.find((x) => x.ticker === t);
    if (!p) return;
    setJenisAset(p.jenisAset);
    setMataUang(p.mataUang);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const g: Record<string, string> = {};
    const t = ticker.trim().toUpperCase();
    if (!t) g.ticker = "Pilih atau ketik tickernya.";
    if (!tanggal) g.tanggal = "Tanggal wajib diisi.";
    if (!Number.isFinite(nKotor) || nKotor <= 0) {
      g.kotor = "Isi jumlah kotor yang positif.";
    }
    if (!Number.isFinite(nPajak) || nPajak < 0) {
      g.pajak = "Pajak tidak boleh negatif. Kosongkan kalau tidak ada potongan.";
    } else if (Number.isFinite(nKotor) && nPajak > nKotor) {
      // Pajak melebihi dividennya berarti salah ketik kolom, dan kalau lolos
      // dia akan tampil sebagai dividen negatif yang mengurangi kas.
      g.pajak = "Pajak lebih besar dari jumlah kotornya. Periksa lagi strukmu.";
    }
    setGalat(g);
    if (Object.keys(g).length) return;

    setSibuk(true);
    try {
      const nPerUnit = perUnit.trim() ? bacaAngka(perUnit) : Number.NaN;
      const dok: Dividen = {
        id: sunting?.id ?? buatId(),
        uid: pengguna?.uid ?? "lokal",
        ticker: t,
        jenisAset,
        tanggal,
        jumlahKotor: nKotor,
        pajak: nPajak,
        mataUang,
        perUnit: Number.isFinite(nPerUnit) && nPerUnit > 0 ? nPerUnit : undefined,
        catatan: catatan.trim() || undefined,
        dibuatPada: sunting?.dibuatPada ?? Date.now(),
      };
      // Firestore menolak nilai undefined, dan kunci yang tidak ada lebih
      // jujur daripada kunci berisi null.
      if (dok.perUnit === undefined) delete dok.perUnit;
      if (!dok.catatan) delete dok.catatan;
      await simpan("dividen", dok);
      tutup();
    } finally {
      setSibuk(false);
    }
  }

  const dipegang = posisi.filter((p) => p.qty > 0);
  const diluarPosisi = ticker.trim() && !dipegang.some((p) => p.ticker === ticker.trim().toUpperCase());

  return (
    <form onSubmit={kirim} className="space-y-4">
      <Bidang
        label="Ticker"
        wajib
        galat={galat.ticker}
        petunjuk={
          diluarPosisi
            ? "Ticker ini tidak sedang dipegang. Tetap boleh: dividen bisa masuk setelah posisinya dijual."
            : "Pilih dari posisi yang dipegang, atau ketik sendiri."
        }
      >
        <Isian
          value={ticker}
          list="dividen-ticker"
          onChange={(e) => pilihPosisi(e.target.value.toUpperCase())}
          placeholder="MSFT"
        />
        <datalist id="dividen-ticker">
          {dipegang.map((p) => (
            <option key={p.ticker} value={p.ticker} />
          ))}
        </datalist>
      </Bidang>

      <div className="grid grid-cols-2 gap-3">
        <Bidang label="Tanggal bayar" wajib galat={galat.tanggal} petunjuk="Saat uangnya masuk, bukan tanggal ex-div.">
          <Isian
            type="date"
            value={tanggal}
            max={hariIni()}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Bidang>
        <Bidang label="Kelas aset">
          <Pilihan value={jenisAset} onChange={(e) => setJenisAset(e.target.value as JenisAset)}>
            <option value="saham">Saham</option>
            <option value="kripto">Kripto</option>
          </Pilihan>
        </Bidang>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Bidang label="Jumlah kotor" wajib galat={galat.kotor} petunjuk="Sebelum potongan pajak.">
          <IsianAngka
            value={kotor}
            onChange={(e) => setKotor(e.target.value)}
            placeholder="1,70"
          />
        </Bidang>
        <Bidang label="Mata uang">
          <Pilihan value={mataUang} onChange={(e) => setMataUang(e.target.value as MataUang)}>
            <option value="USD">USD</option>
            <option value="IDR">IDR</option>
          </Pilihan>
        </Bidang>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Bidang
          label="Pajak dipotong"
          galat={galat.pajak}
          petunjuk="Salin dari struk. Nakhoda tidak menurunkannya sendiri."
        >
          <IsianAngka value={pajak} onChange={(e) => setPajak(e.target.value)} placeholder="0" />
        </Bidang>
        <Bidang label="Per unit" petunjuk="Opsional, untuk jejak audit.">
          <IsianAngka
            value={perUnit}
            onChange={(e) => setPerUnit(e.target.value)}
            placeholder="0,17"
          />
        </Bidang>
      </div>

      {Number.isFinite(nKotor) && nKotor > 0 ? (
        <div className="flex items-baseline justify-between border border-bordr bg-surface-sunk px-3.5 py-3">
          <span className="text-[13px] text-ink-soft">Masuk ke kas</span>
          <span className="angka text-[15px] font-semibold text-naik">
            +{formatUang(bersih, mataUang)}
          </span>
        </div>
      ) : null}

      <Bidang label="Catatan" petunjuk="Opsional. Mis. 'dividen kuartalan Q3'.">
        <AreaTeks value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} className="min-h-16" />
      </Bidang>

      <KakiPanel>
        <Tombol type="button" rupa="hantu" onClick={tutup}>Batal</Tombol>
        <Tombol type="submit" rupa="utama" disabled={sibuk}>
          {sibuk ? "Menyimpan" : "Simpan"}
        </Tombol>
      </KakiPanel>
    </form>
  );
}
