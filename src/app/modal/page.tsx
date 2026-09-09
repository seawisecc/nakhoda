"use client";

import { useState } from "react";
import { Info, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { ArusModal } from "@/types";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatUang } from "@/lib/format";
import { formatTanggal } from "@/lib/tanggal";
import { bersihkanParam, useParamKueri } from "@/lib/param";
import { Kartu, JudulKartu, Kosong, Lencana, Tombol } from "@/components/ui/dasar";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";
import { JalaUbin, Ubin } from "@/components/ui/statistik";
import { FormModal } from "@/components/formulir/form-modal";
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
  const { arusModal, ringkasan, pengaturan, hapus } = usePortofolio();
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [sunting, setSunting] = useState<ArusModal | null>(null);
  const [akanHapus, setAkanHapus] = useState<ArusModal | null>(null);

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

  return (
    <div className="space-y-4">
      <JalaUbin>
        <Ubin label="Modal bersih" nilai={formatUang(ringkasan.modalBersih, dasar, { ringkas: true })} sub="setoran dikurangi penarikan" />
        <Ubin label="Total disetor" nilai={formatUang(ringkasan.totalSetor, dasar, { ringkas: true })} />
        <Ubin label="Total ditarik" nilai={formatUang(ringkasan.totalTarik, dasar, { ringkas: true })} />
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
