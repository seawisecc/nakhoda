"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle, Check, Cloud, Download, HardDrive, Upload, Wand2,
} from "lucide-react";
import type { MataUang } from "@/types";
import { useData } from "@/lib/data/penyedia";
import { usePortofolio } from "@/lib/data/portofolio";
import { bacaCadangan, unduhCadangan, unduhCsvTransaksi } from "@/lib/data/ekspor";
import { dataContoh } from "@/lib/data/contoh";
import { turunkanTarif } from "@/lib/hitung/biaya";
import { bacaAngka, formatAngka, formatUang } from "@/lib/format";
import { selangWaktu } from "@/lib/tanggal";
import { Bidang, IsianAngka, Kartu, JudulKartu, Lencana, Pilihan, Tombol } from "@/components/ui/dasar";
import { TombolTema } from "@/components/shell/tombol-tema";
import { KakiPanel, Panel } from "@/components/ui/panel";

export default function HalamanPengaturan() {
  const {
    mode, pengguna, pengaturan, simpanPengaturan, simpan, bersihkanSemua,
    transaksi, arusModal, jurnal, saran, snapshot,
  } = useData();
  const { kurs } = usePortofolio();

  const [targetMin, setTargetMin] = useState(String(pengaturan.targetBulananMin));
  const [targetMaks, setTargetMaks] = useState(String(pengaturan.targetBulananMax));
  const [targetKekayaan, setTargetKekayaan] = useState(String(pengaturan.targetKekayaan));
  const [kursManual, setKursManual] = useState(String(pengaturan.kursManualUsdIdr));
  const [feeSaham, setFeeSaham] = useState(String(pengaturan.feePersenSaham));
  const [feeKripto, setFeeKripto] = useState(String(pengaturan.feePersenKripto));
  const [kotor, setKotor] = useState("");
  const [nyata, setNyata] = useState("");
  const [tersimpan, setTersimpan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const adaData = transaksi.length + arusModal.length + jurnal.length + saran.length > 0;

  async function simpanTarget() {
    const min = bacaAngka(targetMin);
    const maks = bacaAngka(targetMaks);
    const kekayaan = bacaAngka(targetKekayaan);
    const manual = bacaAngka(kursManual);
    const fs = bacaAngka(feeSaham);
    const fk = bacaAngka(feeKripto);
    if (![min, maks, kekayaan, manual].every((n) => Number.isFinite(n) && n > 0)) {
      setPesan("Semua angka harus positif.");
      return;
    }
    // Fee boleh nol, tapi tidak boleh negatif: fee negatif akan menaikkan laba
    // secara diam-diam di setiap transaksi.
    if (![fs, fk].every((n) => Number.isFinite(n) && n >= 0)) {
      setPesan("Tarif fee harus nol atau lebih.");
      return;
    }
    if (min > maks) {
      setPesan("Target minimum tidak boleh lebih besar dari target maksimum.");
      return;
    }
    setPesan(null);
    await simpanPengaturan({
      targetBulananMin: min,
      targetBulananMax: maks,
      targetKekayaan: kekayaan,
      kursManualUsdIdr: manual,
      feePersenSaham: fs,
      feePersenKripto: fk,
    });
    setTersimpan(true);
    setTimeout(() => setTersimpan(false), 2200);
  }

  async function muatContoh() {
    const isi = dataContoh(pengguna?.uid ?? "lokal");
    for (const t of isi.transaksi) await simpan("transaksi", t);
    for (const a of isi.arusModal) await simpan("arusModal", a);
    for (const j of isi.jurnal) await simpan("jurnal", j);
    for (const s of isi.saran) await simpan("saran", s);
    for (const s of isi.snapshot) await simpan("snapshot", s);
    setPesan("Data contoh dimuat. Hapus semua data kalau sudah selesai melihat-lihat.");
  }

  async function imporBerkas(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const isi = bacaCadangan(await f.text());
      const uid = pengguna?.uid ?? "lokal";
      for (const t of isi.transaksi) await simpan("transaksi", { ...t, uid });
      for (const a of isi.arusModal) await simpan("arusModal", { ...a, uid });
      for (const j of isi.jurnal) await simpan("jurnal", { ...j, uid });
      for (const s of isi.saran) await simpan("saran", { ...s, uid });
      for (const s of isi.snapshot) await simpan("snapshot", { ...s, uid });
      if (isi.pengaturan) await simpanPengaturan({ ...isi.pengaturan, uid });
      setPesan(
        `Impor selesai: ${isi.transaksi.length} transaksi, ${isi.arusModal.length} arus modal, ` +
          `${isi.jurnal.length} entri jurnal. Baris dengan id yang sama ditimpa, bukan digandakan.`,
      );
    } catch (err) {
      setPesan(`Gagal mengimpor: ${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {pesan ? (
        <div className="flex items-start gap-2.5 border border-bordr bg-surface-2 px-4 py-3">
          <p className="flex-1 text-[13px] leading-relaxed text-ink-soft">{pesan}</p>
          <button onClick={() => setPesan(null)} className="text-[12px] text-ink-faint hover:text-ink">
            Tutup
          </button>
        </div>
      ) : null}

      {/* ── Target ─────────────────────────────────────────────────── */}
      <Kartu>
        <JudulKartu
          judul="Target pribadi"
          keterangan="Tarif fee di bawah adalah perkiraan awal, bukan angka resmi Pluang. Periksa dan perbaiki: fee masuk ke basis biaya."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Bidang label="Target return bulanan minimum" petunjuk="Persen.">
            <IsianAngka value={targetMin} onChange={(e) => setTargetMin(e.target.value)} />
          </Bidang>
          <Bidang label="Target return bulanan maksimum" petunjuk="Persen.">
            <IsianAngka value={targetMaks} onChange={(e) => setTargetMaks(e.target.value)} />
          </Bidang>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bidang
            label="Target kekayaan"
            petunjuk={`Dalam ${pengaturan.mataUangDasar}. Ditampilkan sebagai meter di dasbor.`}
          >
            <IsianAngka value={targetKekayaan} onChange={(e) => setTargetKekayaan(e.target.value)} />
          </Bidang>
          <Bidang label="Mata uang dasar" petunjuk="Semua total gabungan ditampilkan dalam mata uang ini.">
            <Pilihan
              value={pengaturan.mataUangDasar}
              onChange={(e) => void simpanPengaturan({ mataUangDasar: e.target.value as MataUang })}
            >
              <option value="IDR">IDR, Rupiah</option>
              <option value="USD">USD, Dolar AS</option>
            </Pilihan>
          </Bidang>
        </div>
        <div className="mt-3">
          <Bidang
            label="Kurs USD ke IDR cadangan"
            petunjuk={
              kurs.sumber === "manual"
                ? "Sedang dipakai. Kurs dari internet belum berhasil diambil."
                : `Hanya dipakai kalau API kurs tidak bisa dihubungi. Sekarang memakai ${kurs.sumber}${
                    kurs.diperbaruiPada ? `, diperbarui ${selangWaktu(kurs.diperbaruiPada)}` : ""
                  }: 1 USD = ${formatUang(kurs.usdIdr, "IDR")}.`
            }
          >
            <IsianAngka value={kursManual} onChange={(e) => setKursManual(e.target.value)} />
          </Bidang>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bidang
            label="Fee saham AS"
            petunjuk="Persen dari nilai tiap transaksi, beli maupun jual."
          >
            <IsianAngka value={feeSaham} onChange={(e) => setFeeSaham(e.target.value)} />
          </Bidang>
          <Bidang label="Fee kripto" petunjuk="Persen. Di Pluang ini berbentuk selisih harga beli-jual.">
            <IsianAngka value={feeKripto} onChange={(e) => setFeeKripto(e.target.value)} />
          </Bidang>
        </div>

        {/* Tarif broker tidak bisa ditebak dengan jujur oleh app mana pun, dan
            tarif yang meleset akan menggeser setiap angka laba tanpa terlihat
            sebagai kesalahan. Jadi disediakan cara menurunkannya dari satu
            transaksi yang benar-benar terjadi. */}
        <details className="mt-3 border border-bordr bg-surface-sunk px-4 py-3">
          <summary className="cursor-pointer text-[13px] text-ink-soft">
            Tidak tahu tarif sebenarnya? Turunkan dari satu transaksi nyata
          </summary>
          <p className="mt-2 text-[12px] text-ink-faint">
            Isi nilai kotor satu transaksi Pluang dan uang yang benar-benar berpindah.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Bidang label="Nilai kotor">
              <IsianAngka value={kotor} onChange={(e) => setKotor(e.target.value)} placeholder="1.000.000" />
            </Bidang>
            <Bidang label="Uang nyata berpindah">
              <IsianAngka value={nyata} onChange={(e) => setNyata(e.target.value)} placeholder="996.500" />
            </Bidang>
            <div className="flex items-end pb-1">
              {(() => {
                const t = turunkanTarif(bacaAngka(kotor), bacaAngka(nyata));
                return (
                  <div>
                    <p className="label-mikro">Tarif tersirat</p>
                    <p className="angka mt-1 text-[19px] font-semibold text-ink">
                      {t === null ? "—" : `${formatAngka(t, 3)}%`}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </details>

        <div className="mt-4 flex items-center gap-3">
          <Tombol rupa="utama" onClick={simpanTarget}>Simpan</Tombol>
          {tersimpan ? (
            <span className="flex items-center gap-1.5 text-[13px] text-naik">
              <Check size={14} />
              Tersimpan
            </span>
          ) : null}
        </div>
      </Kartu>

      {/* ── Tampilan ───────────────────────────────────────────────── */}
      <Kartu>
        <JudulKartu judul="Tampilan" keterangan="Tema kertas adalah tampilan utama. Tema gelap memakai geometri yang sama, hanya tangga permukaannya yang berbalik." />
        <div className="mt-4">
          <TombolTema />
        </div>
      </Kartu>

      {/* ── Penyimpanan ────────────────────────────────────────────── */}
      <Kartu>
        <JudulKartu
          judul="Penyimpanan dan sinkronisasi"
          aksi={
            <Lencana nada={mode === "firestore" ? "naik" : "peringatan"}>
              {mode === "firestore" ? "Firestore" : "lokal"}
            </Lencana>
          }
        />
        <div className="flex items-start gap-3 border border-bordr bg-surface-2 px-4 py-3">
          {mode === "firestore" ? (
            <>
              <Cloud size={16} className="mt-0.5 shrink-0 text-naik" />
              <div className="text-[13px] leading-relaxed text-ink-soft">
                <p>
                  Tersambung ke Firebase sebagai{" "}
                  <span className="font-medium text-ink">{pengguna?.email ?? pengguna?.uid}</span>.
                  Perubahan di laptop muncul di HP tanpa refresh, dan tetap bisa dibuka saat luring
                  lewat cache lokal Firestore.
                </p>
              </div>
            </>
          ) : (
            <>
              <HardDrive size={16} className="mt-0.5 shrink-0 text-peringatan" />
              <div className="text-[13px] leading-relaxed text-ink-soft">
                <p>
                  Data disimpan di browser ini saja, tidak tersinkron ke perangkat lain, dan akan
                  hilang kalau data situs dibersihkan. Isi <code className="text-aksen">.env.local</code>{" "}
                  dengan konfigurasi Firebase untuk menyalakan sinkronisasi. Langkahnya ada di{" "}
                  <code className="text-aksen">README.md</code>.
                </p>
                <p className="mt-2 text-ink-faint">
                  Sampai itu dilakukan, ekspor JSON di bawah adalah satu-satunya cadanganmu.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="jala -mx-4 mt-4 grid-cols-2 text-center sm:grid-cols-5">
          {([
            ["Transaksi", transaksi.length],
            ["Arus modal", arusModal.length],
            ["Jurnal", jurnal.length],
            ["Saran", saran.length],
            ["Snapshot", snapshot.length],
          ] as const).map(([label, n]) => (
            <div key={label} className="px-3 py-2.5">
              <p className="angka text-[17px] font-semibold text-ink">{n}</p>
              <p className="label-mikro mt-1">{label}</p>
            </div>
          ))}
        </div>
      </Kartu>

      {/* ── Cadangan ───────────────────────────────────────────────── */}
      <Kartu>
        <JudulKartu
          judul="Cadangan"
          keterangan="Firebase melindungi dari kehilangan perangkat, bukan dari salah hapus."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Tombol
            onClick={() =>
              unduhCadangan({ transaksi, arusModal, jurnal, saran, snapshot, pengaturan })
            }
            disabled={!adaData}
          >
            <Download size={15} />
            Unduh JSON
          </Tombol>
          <Tombol onClick={() => unduhCsvTransaksi(transaksi)} disabled={!transaksi.length}>
            <Download size={15} />
            Transaksi ke CSV
          </Tombol>
          <Tombol onClick={() => berkas.current?.click()}>
            <Upload size={15} />
            Impor JSON
          </Tombol>
          <input
            ref={berkas}
            type="file"
            accept="application/json,.json"
            onChange={imporBerkas}
            className="hidden"
          />
          {!adaData ? (
            <Tombol onClick={muatContoh}>
              <Wand2 size={15} />
              Muat data contoh
            </Tombol>
          ) : null}
        </div>
      </Kartu>

      {/* ── Zona berbahaya ─────────────────────────────────────────── */}
      <Kartu className="border-turun/25">
        <JudulKartu
          judul="Hapus semua data"
          keterangan="Menghapus seluruh transaksi, arus modal, jurnal, saran, dan snapshot. Tidak bisa dibatalkan."
        />
        <div className="mt-4">
          <Tombol rupa="bahaya" onClick={() => setKonfirmasiHapus(true)} disabled={!adaData}>
            <AlertTriangle size={15} />
            Hapus semua data
          </Tombol>
        </div>
      </Kartu>

      <Panel
        terbuka={konfirmasiHapus}
        tutup={() => setKonfirmasiHapus(false)}
        judul="Hapus semua data?"
        keterangan="Semua transaksi, arus modal, entri jurnal, saran, dan snapshot akan hilang permanen."
      >
        <p className="border border-turun/25 bg-turun-lembut px-4 py-3 text-[13px] leading-relaxed text-turun">
          Unduh cadangan JSON dulu kalau kamu belum yakin. Setelah ini dijalankan, tidak ada cara
          mengembalikannya dari dalam app.
        </p>
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setKonfirmasiHapus(false)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              await bersihkanSemua();
              setKonfirmasiHapus(false);
              setPesan("Semua data dihapus.");
            }}
          >
            Ya, hapus semuanya
          </Tombol>
        </KakiPanel>
      </Panel>
    </div>
  );
}
