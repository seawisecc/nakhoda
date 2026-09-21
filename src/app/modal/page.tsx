"use client";

import { useState } from "react";
import { Coins, Info, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { ArusModal, Dividen } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { bersihkanParam, useParamKueri } from "@/lib/param";
import { Kartu, JudulKartu, Kosong, Lencana, Tombol } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { Baris, JalaUbin, Ubin } from "@/components/ui/statistik";
import { FormModal } from "@/components/formulir/form-modal";
import { FormDividen } from "@/components/formulir/form-dividen";
import { bersihDividen } from "@/lib/hitung/dividen";
import { KakiPanel, Panel } from "@/components/ui/panel";

// "modal awal" memakai nada info, bukan aksen. Aksen sekarang merah dan sewarna
// dengan rugi; lencana merah di sebelah setoran pertama terbaca seperti masalah,
// padahal itu baris paling netral di halaman ini.
const LABEL: Record<ArusModal["tipe"], { teks: string; nada: "info" | "naik" | "turun" }> = {
  awal: { teks: "modal awal", nada: "info" },
  setor: { teks: "setor", nada: "naik" },
  tarik: { teks: "tarik", nada: "turun" },
};

export default function HalamanModal() {
  const {
    arusModal, dividen, posisi, ringkasan, rekapDividen, dividenSepi,
    pengaturan, hapus,
  } = usePortofolio();
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [sunting, setSunting] = useState<ArusModal | null>(null);
  const [akanHapus, setAkanHapus] = useState<ArusModal | null>(null);
  const [formDiv, setFormDiv] = useState(false);
  const [suntingDiv, setSuntingDiv] = useState<Dividen | null>(null);
  const [hapusDiv, setHapusDiv] = useState<Dividen | null>(null);

  const dariUrl = useParamKueri("baru") === "1";
  const formulirTerbuka = formTerbuka || dariUrl;

  function tutupFormulir() {
    setFormTerbuka(false);
    setSunting(null);
    bersihkanParam("baru");
  }

  const dasar = pengaturan.mataUangDasar;
  const urut = [...arusModal].sort(
    (a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0),
  );
  const adaModalAwal = arusModal.some((a) => a.tipe === "awal");
  const urutDividen = [...dividen].sort(
    (a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || 0) - (a.dibuatPada || 0),
  );

  return (
    <div className="space-y-4">
      <JalaUbin>
        <Ubin
          label="Modal bersih"
          nilai={formatUang(ringkasan.modalBersih, dasar, { ringkas: true })}
          sub="setoran dikurangi penarikan"
        />
        <Ubin
          label="Total disetor"
          nilai={formatUang(ringkasan.totalSetor, dasar, { ringkas: true })}
          sub={`ditarik ${formatUang(ringkasan.totalTarik, dasar, { ringkas: true })}`}
        />
        <Ubin
          label="Dividen diterima"
          nilai={formatUang(ringkasan.dividen, dasar, { ringkas: true })}
          sub="dihitung sebagai laba, bukan setoran"
        />
        <Ubin
          label="Nilai sekarang"
          nilai={formatUang(ringkasan.totalNilai, dasar, { ringkas: true })}
          delta={ringkasan.labaTotalPersen}
        />
      </JalaUbin>

      <Kartu>
        <div className="flex items-start gap-2.5 border border-bordr bg-surface-sunk px-4 py-3">
          <Info size={15} className="mt-0.5 shrink-0 text-info" />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Setiap uang masuk dan keluar dicatat di sini, lalu dikeluarkan dari perhitungan return.
            Transfer internal antar dompet Pluang bukan setoran.
          </p>
        </div>

        <JudulKartu
          melekat={false}
          className="mt-5"
          judul="Riwayat arus modal"
          aksi={
            <Tombol
              rupa="utama"
              ukuran="kecil"
              onClick={() => {
                setSunting(null);
                setFormTerbuka(true);
              }}
            >
              <Plus size={14} />
              Catat modal
            </Tombol>
          }
        />

        <div className="mt-4">
          {urut.length ? (
            <Tabel
              kepala={
                <>
                  <Th>Tanggal</Th>
                  <Th>Jenis</Th>
                  <Th>Catatan</Th>
                  <Th kanan>Jumlah</Th>
                  <Th kanan>Kelola</Th>
                </>
              }
            >
              {urut.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap">{formatTanggal(a.tanggal)}</Td>
                  <Td>
                    <Lencana nada={LABEL[a.tipe].nada}>{LABEL[a.tipe].teks}</Lencana>
                  </Td>
                  <Td className="max-w-64">
                    <span className="line-clamp-1 text-ink-faint">{a.catatan || "—"}</span>
                  </Td>
                  <Td kanan>
                    <span
                      className={`angka font-medium ${a.tipe === "tarik" ? "text-turun" : "text-naik"}`}
                    >
                      {a.tipe === "tarik" ? "-" : "+"}
                      {formatUang(a.jumlah, a.mataUang)}
                    </span>
                  </Td>
                  <Td kanan>
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => {
                          setSunting(a);
                          setFormTerbuka(true);
                        }}
                        className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface-2 hover:text-ink"
                        aria-label={`Ubah arus modal ${a.tanggal}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setAkanHapus(a)}
                        className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                        aria-label={`Hapus arus modal ${a.tanggal}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tabel>
          ) : (
            <Kosong
              ikon={<Wallet size={20} />}
              judul="Belum ada modal tercatat"
              keterangan="Mulai dari modal awal: berapa dan kapan."
              aksi={
                <Tombol rupa="utama" onClick={() => setFormTerbuka(true)}>
                  <Plus size={15} />
                  Catat modal awal
                </Tombol>
              }
            />
          )}
        </div>
      </Kartu>

      {/* ── Dividen ─────────────────────────────────────────────────── */}
      <Kartu>
        <JudulKartu
          judul="Dividen"
          keterangan="Uang dari emiten, bukan dari keputusan jual. Masuk ke kas dan dihitung sebagai laba."
          aksi={
            <Tombol
              rupa="utama"
              ukuran="kecil"
              onClick={() => {
                setSuntingDiv(null);
                setFormDiv(true);
              }}
            >
              <Plus size={14} />
              Catat dividen
            </Tombol>
          }
        />

        {dividenSepi.length ? (
          <div className="mt-4 flex items-start gap-2.5 border border-peringatan/40 bg-surface-sunk px-4 py-3">
            <Info size={15} className="mt-0.5 shrink-0 text-peringatan" />
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {dividenSepi.map((d) => d.ticker).join(", ")} pernah membayar dividen tapi belum ada
              catatan baru lebih dari {Math.min(...dividenSepi.map((d) => d.selangHari))} hari.
              Kemungkinan ada yang belum dicatat, bukan emitennya berhenti membayar.
            </p>
          </div>
        ) : null}

        {/* Rekap per ticker sebagai daftar satu kolom, bukan jala ubin:
            cacahnya ikut berapa emiten yang pernah membayar, dan .jala yang
            baris terakhirnya tidak penuh menyisakan slab warna border. */}
        {rekapDividen.length ? (
          <div className="mt-4 border border-bordr bg-surface-sunk px-3.5 py-2">
            {rekapDividen.map((r) => (
              <Baris
                key={r.ticker}
                label={
                  <>
                    <span className="angka text-ink">{r.ticker}</span>
                    <span className="ml-2 text-ink-faint">
                      {r.banyak}x, terakhir {formatTanggal(r.terakhir)}
                    </span>
                  </>
                }
                nilai={formatUang(r.bersih, dasar, { ringkas: true })}
                petunjuk={`Kotor ${formatUang(r.kotor, dasar)}, pajak ${formatUang(r.pajak, dasar)}`}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {urutDividen.length ? (
            <Tabel
              kepala={
                <>
                  <Th>Tanggal</Th>
                  <Th>Ticker</Th>
                  <Th kanan>Kotor</Th>
                  <Th kanan>Pajak</Th>
                  <Th kanan>Bersih</Th>
                  <Th kanan>Kelola</Th>
                </>
              }
            >
              {urutDividen.map((d) => (
                <Tr key={d.id}>
                  <Td className="whitespace-nowrap">{formatTanggal(d.tanggal)}</Td>
                  <Td>
                    <span className="angka font-medium text-ink">{d.ticker}</span>
                    {d.catatan ? (
                      <span className="ml-2 line-clamp-1 text-ink-faint">{d.catatan}</span>
                    ) : null}
                  </Td>
                  <Td kanan>
                    <span className="angka text-ink-soft">{formatUang(d.jumlahKotor, d.mataUang)}</span>
                  </Td>
                  <Td kanan>
                    {/* Pajak nol ditulis sebagai angka, bukan em dash: nol di sini
                        adalah pernyataan bahwa tidak ada potongan, bukan data hilang. */}
                    <span className="angka text-ink-faint">{formatUang(d.pajak, d.mataUang)}</span>
                  </Td>
                  <Td kanan>
                    <span className="angka font-medium text-naik">
                      +{formatUang(bersihDividen(d), d.mataUang)}
                    </span>
                  </Td>
                  <Td kanan>
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => {
                          setSuntingDiv(d);
                          setFormDiv(true);
                        }}
                        className="grid size-8 place-items-center text-ink-faint transition hover:bg-surface-2 hover:text-ink"
                        aria-label={`Ubah dividen ${d.ticker} ${d.tanggal}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setHapusDiv(d)}
                        className="grid size-8 place-items-center text-ink-faint transition hover:bg-turun-lembut hover:text-turun"
                        aria-label={`Hapus dividen ${d.ticker} ${d.tanggal}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tabel>
          ) : (
            <Kosong
              ikon={<Coins size={20} />}
              judul="Belum ada dividen tercatat"
              keterangan="Dividen tidak masuk sendiri. Salin dari struk: tanggal bayar, jumlah kotor, dan pajak yang dipotong."
              aksi={
                <Tombol rupa="utama" onClick={() => setFormDiv(true)}>
                  <Plus size={15} />
                  Catat dividen
                </Tombol>
              }
            />
          )}
        </div>
      </Kartu>

      <FormDividen
        terbuka={formDiv}
        tutup={() => {
          setFormDiv(false);
          setSuntingDiv(null);
        }}
        sunting={suntingDiv}
        posisi={posisi}
      />

      <Panel
        terbuka={hapusDiv !== null}
        tutup={() => setHapusDiv(null)}
        judul="Hapus dividen ini?"
        keterangan="Kas, laba total, dan return bulanan akan dihitung ulang tanpa baris ini."
      >
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setHapusDiv(null)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              if (hapusDiv) await hapus("dividen", hapusDiv.id);
              setHapusDiv(null);
            }}
          >
            Hapus
          </Tombol>
        </KakiPanel>
      </Panel>

      <FormModal
        terbuka={formulirTerbuka}
        tutup={tutupFormulir}
        sunting={sunting}
        adaModalAwal={adaModalAwal}
      />

      <Panel
        terbuka={akanHapus !== null}
        tutup={() => setAkanHapus(null)}
        judul="Hapus catatan modal ini?"
        keterangan="Return bulanan dan laba total akan dihitung ulang tanpa baris ini."
      >
        <KakiPanel>
          <Tombol rupa="hantu" onClick={() => setAkanHapus(null)}>Batal</Tombol>
          <Tombol
            rupa="bahaya"
            onClick={async () => {
              if (akanHapus) await hapus("arusModal", akanHapus.id);
              setAkanHapus(null);
            }}
          >
            Hapus
          </Tombol>
        </KakiPanel>
      </Panel>
    </div>
  );
}
