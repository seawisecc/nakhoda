"use client";

import { useMemo, useState } from "react";
import { usePortofolio } from "@/lib/data/portofolio";
import { returnBulananTersirat, simulasiTarget, type HasilSimulasi } from "@/lib/hitung/simulasi";
import { konversi } from "@/lib/hitung/uang";
import { bacaAngka, formatAngka, formatPersen, formatUang } from "@/lib/format";
import { formatBulan, hariIni, kunciBulan, tambahBulan } from "@/lib/tanggal";
import { cn } from "@/lib/cn";
import { Bidang, IsianAngka, JudulKartu, Kartu } from "@/components/ui/dasar";
import { Baris } from "@/components/ui/statistik";
import { Tabel, Td, Th, Tr } from "@/components/ui/tabel";

/** Tingkat return yang selalu ada di tabel kepekaan. Sengaja melebar dari yang
 *  biasa sampai yang agresif, supaya satu tabel menunjukkan betapa tajamnya
 *  jarak waktu berubah terhadap satu angka persen itu. */
const TANGGA_RETURN = [0.5, 1, 2, 3, 5, 10];

function durasi(bulan: number): string {
  if (bulan === 0) return "sudah tercapai";
  const t = Math.floor(bulan / 12);
  const b = bulan % 12;
  if (!t) return `${b} bulan`;
  return b ? `${t} tahun ${b} bulan` : `${t} tahun`;
}

function jawaban(h: HasilSimulasi): string {
  if (h.bulan !== null) return durasi(h.bulan);
  return h.alasan === "tidak-pernah" ? "tidak tercapai" : "lebih dari 50 tahun";
}

export default function HalamanSimulasi() {
  const { ringkasan, arusModal, pengaturan, kurs, siap } = usePortofolio();
  const dasar = pengaturan.mataUangDasar;
  const kini = hariIni();

  // null berarti "pakai angka dari data". Isian baru menyimpan teks setelah
  // disentuh, jadi angka bawaan ikut bergerak begitu data selesai dimuat
  // tanpa efek yang menyetel ulang state.
  const [awalTeks, setAwalTeks] = useState<string | null>(null);
  const [targetTeks, setTargetTeks] = useState<string | null>(null);
  const [returnTeks, setReturnTeks] = useState<string | null>(null);
  const [setoranTeks, setSetoranTeks] = useState("500.000");

  const bawaanAwal = Math.round(ringkasan.totalNilai);
  const awal = awalTeks === null ? bawaanAwal : bacaAngka(awalTeks);
  const target = targetTeks === null ? pengaturan.targetKekayaan : bacaAngka(targetTeks);
  const returnPersen = returnTeks === null ? pengaturan.targetBulananMin : bacaAngka(returnTeks);
  const setoran = setoranTeks.trim() ? bacaAngka(setoranTeks) : 0;

  const aktual = useMemo(
    () =>
      returnBulananTersirat(
        arusModal.map((a) => ({
          tanggal: a.tanggal,
          jumlah: (a.tipe === "tarik" ? -1 : 1) * konversi(Math.abs(a.jumlah), a.mataUang, dasar, kurs),
        })),
        ringkasan.totalNilai,
        kini,
      ),
    [arusModal, ringkasan.totalNilai, dasar, kurs, kini],
  );

  const valid = [awal, target, returnPersen, setoran].every(Number.isFinite) && target > 0;
  const hasil = valid ? simulasiTarget({ awal, target, returnPersen, setoran }) : null;

  const tangga = useMemo(() => {
    const semua = new Set(TANGGA_RETURN);
    if (Number.isFinite(returnPersen)) semua.add(returnPersen);
    if (aktual !== null) semua.add(Math.round(aktual * 100) / 100);
    return [...semua].sort((a, b) => a - b);
  }, [returnPersen, aktual]);

  const bulanIni = kunciBulan(kini);

  return (
    <div className="max-w-3xl space-y-4">
      <Kartu>
        <JudulKartu
          judul="Simulasi target"
          keterangan="Tiap bulan nilai tumbuh sebesar return dari nilai saat itu, lalu setoran masuk. Setoran bulan itu belum ikut berbunga."
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Bidang label="Mulai dari" petunjuk="Bawaannya nilai portofolio sekarang.">
            <IsianAngka
              value={awalTeks ?? (siap ? formatAngka(bawaanAwal, 0) : "")}
              onChange={(e) => setAwalTeks(e.target.value)}
            />
          </Bidang>
          <Bidang label="Target" petunjuk="Bawaannya target kekayaan di Pengaturan.">
            <IsianAngka
              value={targetTeks ?? formatAngka(pengaturan.targetKekayaan, 0)}
              onChange={(e) => setTargetTeks(e.target.value)}
            />
          </Bidang>
          <Bidang
            label="Return per bulan (%)"
            petunjuk={
              aktual !== null ? (
                <>
                  Return aktualmu sejauh ini{" "}
                  <button
                    type="button"
                    onClick={() => setReturnTeks(formatAngka(aktual, 2))}
                    className="angka text-ink underline decoration-dotted underline-offset-2"
                  >
                    {formatPersen(aktual, 2, false)}
                  </button>{" "}
                  per bulan. Perkiraan: modal awal masih hitung mundur.
                </>
              ) : (
                "Riwayat belum cukup panjang untuk menghitung return aktual."
              )
            }
          >
            <IsianAngka
              value={returnTeks ?? formatAngka(pengaturan.targetBulananMin, 2)}
              onChange={(e) => setReturnTeks(e.target.value)}
            />
          </Bidang>
          <Bidang label="Setoran per bulan" petunjuk="Kosongkan kalau tidak ada setoran.">
            <IsianAngka value={setoranTeks} onChange={(e) => setSetoranTeks(e.target.value)} />
          </Bidang>
        </div>
      </Kartu>

      {hasil ? (
        <Kartu>
          <p className="label-mikro">Tembus {formatUang(target, dasar, { ringkas: true })} dalam</p>
          <p className="angka-sorot mt-3 text-[32px] leading-none font-semibold text-ink sm:text-[44px]">
            {jawaban(hasil)}
          </p>
          {hasil.bulan ? (
            <p className="mt-3 text-[13px] text-ink-soft">
              Sekitar <span className="angka text-ink">{formatBulan(tambahBulan(bulanIni, hasil.bulan))}</span>
            </p>
          ) : null}

          {hasil.bulan ? (
            <div className="mt-5 border-t border-bordr pt-2">
              <Baris label="Nilai saat itu" nilai={formatUang(hasil.nilaiAkhir, dasar)} />
              <Baris
                label="Dari uangmu sendiri"
                nilai={`${formatUang(hasil.totalSetor, dasar)} (${formatPersen((hasil.totalSetor / hasil.nilaiAkhir) * 100, 0, false)})`}
                petunjuk="Nilai awal ditambah seluruh setoran sampai bulan tembus."
              />
              <Baris
                label="Dari return"
                nilai={`${formatUang(hasil.totalReturn, dasar)} (${formatPersen((hasil.totalReturn / hasil.nilaiAkhir) * 100, 0, false)})`}
              />
            </div>
          ) : null}
        </Kartu>
      ) : (
        <Kartu>
          <p className="text-[13px] text-ink-soft">Isi keempat angka di atas dengan angka yang valid.</p>
        </Kartu>
      )}

      {hasil && hasil.tonggak.length ? (
        <Kartu>
          <JudulKartu judul="Tonggak di jalan" />
          <div className="mt-4">
            <Tabel
              className="min-w-0"
              kepala={
                <>
                  <Th>Tonggak</Th>
                  <Th>Kapan</Th>
                  {/* Di layar sempit "Lama" disembunyikan: "Kapan" sudah menjawab
                      hal yang sama, dan empat kolom membuat durasinya patah
                      jadi tiga baris. */}
                  <Th kanan className="hidden sm:table-cell">Lama</Th>
                  <Th kanan>Dari setoran</Th>
                </>
              }
            >
              {hasil.tonggak.map((t) => (
                <Tr key={t.nilai}>
                  <Td className="whitespace-nowrap">
                    <span className="angka font-medium text-ink">{formatUang(t.nilai, dasar, { ringkas: true })}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatBulan(tambahBulan(bulanIni, t.bulan))}</Td>
                  <Td kanan className="hidden whitespace-nowrap sm:table-cell">
                    <span className="angka text-ink-soft">{durasi(t.bulan)}</span>
                  </Td>
                  <Td kanan>
                    <span className="angka text-ink-soft">{formatPersen(t.porsiSetoran * 100, 0, false)}</span>
                  </Td>
                </Tr>
              ))}
            </Tabel>
          </div>
        </Kartu>
      ) : null}

      {valid ? (
        <Kartu>
          <JudulKartu
            judul="Kalau return-nya berbeda"
            keterangan="Nilai awal dan target sama, hanya return per bulan yang berubah."
          />
          <div className="mt-4">
            <Tabel
              className="min-w-0"
              kepala={
                <>
                  <Th>Return/bulan</Th>
                  <Th kanan>Tanpa setoran</Th>
                  <Th kanan>Setor {formatUang(setoran, dasar, { ringkas: true })}/bln</Th>
                </>
              }
            >
              {tangga.map((r) => {
                const tanpa = simulasiTarget({ awal, target, returnPersen: r, setoran: 0 });
                const dengan = simulasiTarget({ awal, target, returnPersen: r, setoran });
                const dipilih = r === returnPersen;
                const nyata = aktual !== null && r === Math.round(aktual * 100) / 100;
                return (
                  <Tr key={r} className={cn(dipilih && "bg-surface-sunk hover:bg-surface-sunk")}>
                    <Td>
                      <span className={cn("angka", dipilih ? "font-semibold text-ink" : "text-ink-soft")}>
                        {formatPersen(r, 2, false)}
                      </span>
                      {nyata ? <span className="label-mikro ml-2">aktual</span> : null}
                      {dipilih && !nyata ? <span className="label-mikro ml-2">dipilih</span> : null}
                    </Td>
                    <Td kanan>
                      <span className="angka text-ink-soft">{jawaban(tanpa)}</span>
                    </Td>
                    <Td kanan>
                      <span className={cn("angka", dipilih ? "font-semibold text-ink" : "text-ink-soft")}>
                        {jawaban(dengan)}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </Tabel>
          </div>
        </Kartu>
      ) : null}
    </div>
  );
}
