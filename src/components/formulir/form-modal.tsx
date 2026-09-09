"use client";

import { useState } from "react";
import type { ArusModal, MataUang, TipeArus } from "@/types";
import { useData, buatId } from "@/lib/data/penyedia";
import { bacaAngka, formatUang } from "@/lib/format";
import { hariIni } from "@/lib/tanggal";
import { AreaTeks, Bidang, Isian, IsianAngka, Pilihan, Tombol } from "@/components/ui/dasar";
import { KakiPanel, Panel } from "@/components/ui/panel";

/** Isinya dipisah supaya keadaan awal formulir lahir dari useState saat panel
 *  dibuka, bukan dari efek yang menyetel ulang state setelah render pertama. */
export function FormModal({
  terbuka, tutup, sunting, adaModalAwal,
}: {
  terbuka: boolean;
  tutup: () => void;
  sunting?: ArusModal | null;
  adaModalAwal: boolean;
}) {
  return (
    <Panel
      terbuka={terbuka}
      tutup={tutup}
      judul={sunting ? "Ubah arus modal" : "Catat modal"}
      keterangan="Uang yang masuk dan keluar dari portofolio, terpisah dari hasil trading. Inilah yang membuat return bulananmu jujur."
    >
      <IsiFormModal
        key={sunting?.id ?? "baru"}
        tutup={tutup}
        sunting={sunting}
        adaModalAwal={adaModalAwal}
      />
    </Panel>
  );
}

function IsiFormModal({
  tutup, sunting, adaModalAwal,
}: {
  tutup: () => void;
  sunting?: ArusModal | null;
  adaModalAwal: boolean;
}) {
  const { simpan, pengguna } = useData();
  const [tanggal, setTanggal] = useState(sunting?.tanggal ?? hariIni());
  const [jumlah, setJumlah] = useState(sunting ? String(sunting.jumlah) : "");
  const [mataUang, setMataUang] = useState<MataUang>(sunting?.mataUang ?? "IDR");
  const [tipe, setTipe] = useState<TipeArus>(
    sunting?.tipe ?? (adaModalAwal ? "setor" : "awal"),
  );
  const [catatan, setCatatan] = useState(sunting?.catatan ?? "");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);

  const nilai = bacaAngka(jumlah);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const g: Record<string, string> = {};
    if (!tanggal) g.tanggal = "Tanggal wajib diisi.";
    // Arah ditentukan oleh tipe, bukan oleh tanda minus. Menerima angka
    // negatif di sini akan membuat "tarik -1 juta" berarti setor, dan itu
    // jenis kesalahan yang baru ketahuan berbulan-bulan kemudian.
    if (!Number.isFinite(nilai) || nilai <= 0) g.jumlah = "Isi jumlah positif. Arahnya dipilih di bawah.";
    setGalat(g);
    if (Object.keys(g).length) return;

    setSibuk(true);
    try {
      const dok: ArusModal = {
        id: sunting?.id ?? buatId(),
        uid: pengguna?.uid ?? "lokal",
        tanggal,
        jumlah: nilai,
        mataUang,
        tipe,
        catatan: catatan.trim() || undefined,
        dibuatPada: sunting?.dibuatPada ?? Date.now(),
      };
      if (!dok.catatan) delete dok.catatan;
      await simpan("arusModal", dok);
      tutup();
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
        <Bidang label="Jenis">
          <Pilihan value={tipe} onChange={(e) => setTipe(e.target.value as TipeArus)}>
            <option value="awal">Modal awal</option>
            <option value="setor">Setor tambahan</option>
            <option value="tarik">Tarik dana</option>
          </Pilihan>
        </Bidang>

        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Tanggal" wajib galat={galat.tanggal}>
            <Isian
              type="date"
              value={tanggal}
              max={hariIni()}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Bidang>
          <Bidang label="Mata uang">
            <Pilihan value={mataUang} onChange={(e) => setMataUang(e.target.value as MataUang)}>
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
            </Pilihan>
          </Bidang>
        </div>

        <Bidang label="Jumlah" wajib galat={galat.jumlah} petunjuk="Selalu angka positif.">
          <IsianAngka
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            placeholder="10.000.000"
          />
        </Bidang>

        {Number.isFinite(nilai) && nilai > 0 ? (
          <div className="flex items-baseline justify-between border border-bordr bg-surface-sunk px-3.5 py-3">
            <span className="text-[13px] text-ink-soft">
              {tipe === "tarik" ? "Keluar dari portofolio" : "Masuk ke portofolio"}
            </span>
            <span className={`angka text-[15px] font-semibold ${tipe === "tarik" ? "text-turun" : "text-naik"}`}>
              {tipe === "tarik" ? "-" : "+"}
              {formatUang(nilai, mataUang)}
            </span>
          </div>
        ) : null}

        <Bidang label="Catatan" petunjuk="Opsional. Mis. 'transfer dari gaji Agustus'.">
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
