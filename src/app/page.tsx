"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, Coins, Info, Sparkles, TrendingUp, Wallet,
} from "lucide-react";
import { usePortofolio } from "@/lib/data/portofolio";
import { formatPersen, formatUang, tandaArah } from "@/lib/format";
import { formatBulan, formatTanggal, hariIni, kunciBulan, selangWaktu } from "@/lib/tanggal";
import {
  Kartu, JudulKartu, Kosong, Lencana, PenandaTicker, Tombol, warnaArah,
} from "@/components/ui/dasar";
import { Ubin, Baris, JalaUbin } from "@/components/ui/statistik";
import { Area, Donat, MeterKekayaan, MeterTarget } from "@/components/ui/grafik";
import { cn } from "@/lib/cn";

/* Kalimat penutup panel realisasi, satu per keadaan.
 *
 * "Belum" sengaja tidak berbunyi seperti teguran. Bulan tanpa penjualan bukan
 * bulan yang gagal: posisi yang ditahan sesuai rencana justru tidak boleh
 * dipaksa keluar cuma supaya angkanya bergerak, dan panel ini akan jadi
 * dorongan untuk melakukan persis itu kalau nadanya salah. */
const PESAN_REALISASI: Record<string, string> = {
  kosong: "Belum ada modal tercatat, jadi persennya belum bisa dihitung.",
  rugi: "Bulan ini penjualannya menutup rugi. Yang perlu ditengok jurnalnya, bukan angkanya.",
  belum:
    "Belum sampai target bawah. Posisi yang masih berjalan tidak dihitung di sini sampai benar-benar dijual.",
  tercapai: "Sudah masuk rentang target bulan ini.",
  lampaui: "Sudah lewat target atas bulan ini.",
};

export default function Dasbor() {
  const {
    ringkasan, dietz, kinerjaTrade, realisasiBulan, posisiAktif, saran, snapshot,
    pengaturan, transaksi, arusModal, hargaTertua, pesanSegar, bersihkanPesanSegar,
    siap, kurs,
  } = usePortofolio();

  const dasar = pengaturan.mataUangDasar;
  const kosongTotal = transaksi.length === 0 && arusModal.length === 0;

  const titikGrafik = [...snapshot]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .slice(-90)
    .map((s) => ({ tanggal: s.tanggal, nilai: s.nilaiTotal }));

  const saranMenunggu = saran.filter((s) => s.status === "menunggu");
  const teratas = [...posisiAktif]
    .sort((a, b) => (b.nilaiPasar ?? b.biayaTotal) - (a.nilaiPasar ?? a.biayaTotal))
    .slice(0, 5);

  if (!siap) return <KerangkaMuat />;

  if (kosongTotal) {
    return (
      <Kartu className="mt-6">
        <Kosong
          ikon={<Wallet size={22} />}
          judul="Belum ada apa-apa di sini, dan itu wajar"
          keterangan="Mulai dari modal awal, supaya angka return-mu bermakna sejak hari pertama."
          aksi={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/modal?baru=1">
                <Tombol rupa="utama">Catat modal awal</Tombol>
              </Link>
              <Link href="/transaksi?baru=1">
                <Tombol>Catat transaksi</Tombol>
              </Link>
            </div>
          }
        />
      </Kartu>
    );
  }

  return (
    <div className="space-y-3">
      {pesanSegar ? (
        <div className="flex items-start gap-2.5 border border-peringatan/40 bg-surface-2 px-4 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-peringatan" />
          <p className="flex-1 text-[12px] leading-relaxed text-ink-soft">{pesanSegar}</p>
          <button
            onClick={bersihkanPesanSegar}
            className="label-mikro shrink-0 hover:text-ink"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* ── Papan induk ────────────────────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="kartu-utama flex flex-col lg:col-span-2">
          {/* Kepala papan. Pita mata uang dan tanggal duduk sebaris dengan
              nama ukurannya, seperti kepala instrumen; dasar mata uang harus
              terbaca sebelum angkanya, bukan sesudah. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--utama-garis)] px-4 py-2">
            <span className="label-mikro">Total portofolio</span>
            <span className="chip border-bordr bg-surface-2 text-ink-soft">{dasar}</span>
            <span className="label-mikro ml-auto">{formatTanggal(hariIni())}</span>
          </div>

          {/* flex-1 di blok ini, bukan tinggi tetap: papan induk ikut tinggi
              panel Return di sebelahnya, dan tanpa ini sisa ruangnya jatuh
              sebagai pita kosong di bawah jala rincian. Yang harus melar
              adalah bidang angkanya, bukan celah di kaki panel. */}
          <div className="flex-1 px-4 py-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <p className="angka-sorot masuk text-[26px] leading-none font-semibold text-[var(--utama-teks)] sm:text-[40px] lg:text-[52px]">
                  {formatUang(ringkasan.totalNilai, dasar)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      "angka text-[14px] font-medium",
                      ringkasan.labaTotal >= 0
                        ? "text-[var(--utama-naik)]"
                        : "text-[var(--utama-turun)]",
                    )}
                  >
                    <span aria-hidden>{tandaArah(ringkasan.labaTotal)}</span>{" "}
                    {formatUang(Math.abs(ringkasan.labaTotal), dasar)}
                    <span className="ml-1.5 opacity-75">
                      ({formatPersen(ringkasan.labaTotalPersen)})
                    </span>
                  </span>
                  <span className="label-mikro">sejak modal pertama masuk</span>
                </div>
              </div>

              <div className="w-full text-left sm:w-auto sm:text-right">
                <p className="label-mikro">Modal bersih</p>
                <p className="angka mt-1.5 text-[17px] leading-none font-medium text-[var(--utama-teks-soft)]">
                  {formatUang(ringkasan.modalBersih, dasar)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <MeterKekayaan
                nilai={ringkasan.totalNilai}
                target={pengaturan.targetKekayaan}
                mataUang={dasar}
              />
            </div>
          </div>

          {/* Rincian sebagai jala hairline yang membentang penuh ke tepi
              papan, bukan sebagai tiga kolom mengambang di dalam padding.
              Ini yang membuat papannya terbaca sebagai alat ukur bersusun. */}
          <div className="jala grid-cols-1 border-x-0 border-b-0 sm:grid-cols-3">
            {([
              ["Nilai posisi", ringkasan.nilaiPosisi],
              ["Kas", ringkasan.kas],
              ["Sudah terealisasi", ringkasan.labaTerealisasi],
            ] as const).map(([label, nilai]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 px-4 py-2 sm:block sm:py-2.5"
              >
                <p className="label-mikro">{label}</p>
                <p className="angka text-[15px] leading-none font-medium text-[var(--utama-teks-soft)] sm:mt-1.5">
                  {formatUang(nilai, dasar, { ringkas: true })}
                </p>
              </div>
            ))}
          </div>

          {ringkasan.posisiTanpaHarga > 0 ? (
            <p className="flex items-start gap-2 border-t border-[var(--utama-garis)] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--utama-peringatan)]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {ringkasan.posisiTanpaHarga} posisi belum punya harga pasar dan sementara dinilai
              sebesar modalnya.
            </p>
          ) : null}
        </div>

        {/* ── Return bulan berjalan ──────────────────────────────── */}
        <Kartu className="flex flex-col">
          <JudulKartu
            judul={`Return ${formatBulan(kunciBulan(hariIni()))}`}
            keterangan="Modified Dietz. Setoran modal baru tidak terbaca sebagai keuntungan."
          />

          <div className="flex items-baseline gap-2">
            <span className={cn("angka-sorot text-[36px] leading-none font-semibold", warnaArah(dietz.persen))}>
              {dietz.persen === null ? "—" : formatPersen(dietz.persen)}
            </span>
            {dietz.bmvPerkiraan && dietz.persen !== null ? (
              <Lencana nada="peringatan">perkiraan</Lencana>
            ) : null}
          </div>

          <div className="mt-5">
            <MeterTarget
              nilai={dietz.persen}
              min={pengaturan.targetBulananMin}
              maks={pengaturan.targetBulananMax}
            />
          </div>

          <div className="mt-5 flex-1 border-t border-bordr pt-1">
            <Baris label="Nilai awal bulan" nilai={formatUang(dietz.bmv, dasar, { ringkas: true })} />
            <Baris label="Nilai sekarang" nilai={formatUang(dietz.emv, dasar, { ringkas: true })} />
            <Baris
              label="Arus modal bulan ini"
              nilai={formatUang(dietz.arusBersih, dasar, { ringkas: true })}
              petunjuk="Setoran dikurangi penarikan selama bulan berjalan. Angka ini dikeluarkan dari perhitungan return."
            />
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            {dietz.alasanKosong
              ? dietz.alasanKosong
              : dietz.bmvPerkiraan
                ? "Nilai awal bulan masih perkiraan, jadi presisi mulai bulan depan."
                : `Dihitung atas ${dietz.hari} hari berjalan.`}
          </p>
        </Kartu>
      </section>

      {/* ── Realisasi bulan berjalan ───────────────────────────────────
          Panel sendiri, tidak digabung ke panel Return, karena keduanya
          menjawab pertanyaan yang berbeda dan akan sering berbeda angkanya.
          Return mengukur seluruh modal termasuk yang masih mengambang;
          yang di sini cuma uang yang sudah benar-benar dikunci. */}
      <Kartu>
        <JudulKartu
          judul={`Sudah jadi uang, ${formatBulan(kunciBulan(hariIni()))}`}
          keterangan="Hasil penjualan dikurangi biaya perolehannya. Posisi yang masih terbuka tidak dihitung di sini, berapa pun untungnya di layar."
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={cn(
                  "angka text-[30px] leading-none font-semibold",
                  warnaArah(realisasiBulan.realisasi),
                )}
              >
                <span aria-hidden>{tandaArah(realisasiBulan.realisasi)}</span>{" "}
                {formatUang(Math.abs(realisasiBulan.realisasi), dasar)}
              </span>
              {realisasiBulan.persen !== null ? (
                <span className="angka text-[14px] text-ink-soft">
                  {formatPersen(realisasiBulan.persen)} dari modal
                </span>
              ) : null}
            </div>

            <div className="mt-5">
              <MeterTarget
                nilai={realisasiBulan.persen}
                min={pengaturan.targetBulananMin}
                maks={pengaturan.targetBulananMax}
              />
            </div>

            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              {PESAN_REALISASI[realisasiBulan.status]}
            </p>
          </div>

          <div className="border-t border-bordr pt-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <Baris
              label="Modal bersih"
              nilai={formatUang(realisasiBulan.modal, dasar, { ringkas: true })}
              petunjuk="Setoran dikurangi penarikan. Ini penyebut targetnya, bukan nilai portofolio, supaya targetnya tidak ikut bergerak setiap kali harga pasar bergerak."
            />
            <Baris
              label={`Target ${formatPersen(pengaturan.targetBulananMin, 0, false)} sampai ${formatPersen(pengaturan.targetBulananMax, 0, false)}`}
              nilai={`${formatUang(realisasiBulan.targetMin, dasar, { ringkas: true })} sampai ${formatUang(realisasiBulan.targetMax, dasar, { ringkas: true })}`}
            />
            <Baris
              label="Kurang berapa lagi"
              nilai={
                realisasiBulan.realisasi >= realisasiBulan.targetMin
                  ? "sudah lewat"
                  : formatUang(realisasiBulan.targetMin - realisasiBulan.realisasi, dasar, {
                      ringkas: true,
                    })
              }
            />
            <Baris label="Penjualan bulan ini" nilai={realisasiBulan.jumlahJual} />
          </div>
        </div>
      </Kartu>

      {/* ── Ubin ringkas ───────────────────────────────────────────── */}
      <JalaUbin>
        <Ubin
          label="Belum terealisasi"
          ikon={<TrendingUp size={12} />}
          nilai={
            <span className={warnaArah(ringkasan.labaBelumTerealisasi)}>
              {formatUang(ringkasan.labaBelumTerealisasi, dasar, { ringkas: true })}
            </span>
          }
          sub="dari posisi terbuka"
        />
        <Ubin
          label="Sudah terealisasi"
          ikon={<Coins size={12} />}
          nilai={
            <span className={warnaArah(ringkasan.labaTerealisasi)}>
              {formatUang(ringkasan.labaTerealisasi, dasar, { ringkas: true })}
            </span>
          }
          sub="dari yang sudah dijual, sejak awal"
        />
        <Ubin
          label="Kas menganggur"
          ikon={<Wallet size={12} />}
          nilai={
            <span className={ringkasan.kas < 0 ? "text-peringatan" : undefined}>
              {formatUang(ringkasan.kas, dasar, { ringkas: true })}
            </span>
          }
          sub={
            // Kas negatif berarti belanja melebihi modal yang tercatat, dan itu
            // hampir selalu berarti ada setoran yang lupa dicatat, bukan bahwa
            // portofolionya bermasalah. Lebih baik dikatakan langsung.
            ringkasan.kas < 0
              ? "ada setoran modal yang belum dicatat"
              : ringkasan.totalNilai > 0
                ? `${formatPersen((ringkasan.kas / ringkasan.totalNilai) * 100, 1, false)} dari porto`
                : undefined
          }
        />
        <Ubin
          label="Win rate"
          ikon={<Sparkles size={12} />}
          nilai={kinerjaTrade.winRate === null ? "—" : formatPersen(kinerjaTrade.winRate, 1, false)}
          sub={
            kinerjaTrade.total
              ? `${kinerjaTrade.menang} menang dari ${kinerjaTrade.total} trade`
              : "belum ada posisi yang ditutup"
          }
        />
      </JalaUbin>

      {/* ── Grafik dan alokasi ─────────────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-3">
        {/* Panel grafik dibuat kolom fleks dan grafiknya mengisi sisa ruang.
            Tinggi baris ini ditentukan panel Alokasi di sebelahnya (donat plus
            tiga baris legenda), jadi menyetel tinggi grafik dengan angka tetap
            selalu meninggalkan bidang kosong di bawah kurva. */}
        <Kartu className="flex flex-col lg:col-span-2">
          <JudulKartu
            judul="Nilai portofolio"
            keterangan={
              titikGrafik.length >= 2
                ? `${titikGrafik.length} hari terakhir`
                : "Satu foto disimpan per hari saat app dibuka."
            }
          />
          <div className="min-h-[200px] flex-1">
            <Area titik={titikGrafik} mataUang={dasar} mengisi />
          </div>
        </Kartu>

        <Kartu>
          <JudulKartu judul="Alokasi" keterangan="Sebaran nilai per kelas aset." />
          <Donat
            mataUang={dasar}
            judulTengah="Total"
            nilaiTengah={formatUang(ringkasan.totalNilai, dasar, { ringkas: true })}
            irisan={[
              { label: "Saham AS", nilai: ringkasan.alokasi.saham, seri: 0 },
              { label: "Kripto", nilai: ringkasan.alokasi.kripto, seri: 1 },
              { label: "Kas", nilai: ringkasan.alokasi.kas, seri: 2 },
            ]}
          />
        </Kartu>
      </section>

      {/* ── Posisi teratas dan saran ───────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <JudulKartu
            judul="Posisi terbesar"
            keterangan={hargaTertua ? `Harga terakhir diambil ${selangWaktu(hargaTertua)}.` : undefined}
            aksi={
              <Link
                href="/posisi"
                className="label-mikro inline-flex items-center gap-1 text-aksen hover:underline"
              >
                Semua posisi <ArrowUpRight size={12} />
              </Link>
            }
          />
          {teratas.length ? (
            <ul className="-mx-4 -mb-4">
              {teratas.map((p) => (
                <li
                  key={p.ticker}
                  className="flex items-center gap-3 border-b border-bordr px-4 py-2.5 last:border-0"
                >
                  <PenandaTicker ticker={p.ticker} jenisAset={p.jenisAset} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-medium text-ink">{p.ticker}</p>
                    <p className="angka text-[11px] text-ink-faint">
                      {p.jenisAset === "kripto" ? "Kripto" : "Saham AS"} ·{" "}
                      {formatUang(p.avgHarga, p.mataUang)} rata-rata
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="angka text-[13px] font-medium text-ink">
                      {formatUang(p.nilaiPasar ?? p.biayaTotal, p.mataUang, { ringkas: true })}
                    </p>
                    <p className={cn("angka text-[11px]", warnaArah(p.labaBelumTerealisasi ?? null))}>
                      {p.labaBelumTerealisasiPersen === undefined ? (
                        "harga belum ada"
                      ) : (
                        <>
                          <span aria-hidden>{tandaArah(p.labaBelumTerealisasi ?? 0)}</span>{" "}
                          {formatPersen(Math.abs(p.labaBelumTerealisasiPersen), 2, false)}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Kosong
              judul="Belum ada posisi terbuka"
              keterangan="Catat transaksi beli, posisinya muncul otomatis."
              aksi={
                <Link href="/transaksi?baru=1">
                  <Tombol rupa="utama" ukuran="kecil">Catat transaksi</Tombol>
                </Link>
              }
            />
          )}
        </Kartu>

        <Kartu>
          <JudulKartu
            judul="Saran menunggu"
            keterangan="Dari Claude Code dan AI lain."
            aksi={
              saranMenunggu.length ? (
                <Lencana nada="aksen">{saranMenunggu.length}</Lencana>
              ) : undefined
            }
          />
          {saranMenunggu.length ? (
            <>
              <ul className="space-y-2">
                {saranMenunggu.slice(0, 4).map((s) => (
                  <li key={s.id} className="border border-bordr bg-surface-2 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] font-medium text-ink">{s.ticker}</span>
                      <Lencana
                        nada={
                          s.rekomendasi === "beli" ? "naik"
                            : s.rekomendasi === "jual" ? "turun"
                              : "netral"
                        }
                      >
                        {s.rekomendasi}
                      </Lencana>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-faint">
                      {s.catatanTeknikal || s.catatanFundamental}
                    </p>
                    <p className="label-mikro mt-1.5">{formatTanggal(s.tanggal)}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/saran"
                className="label-mikro mt-4 inline-flex items-center gap-1 text-aksen hover:underline"
              >
                Lihat semua saran <ArrowUpRight size={12} />
              </Link>
            </>
          ) : (
            <Kosong
              ikon={<Sparkles size={18} />}
              judul="Tidak ada saran menunggu"
              keterangan="Minta riset dari halaman Tinjauan, atau tempel dari AI lain."
            />
          )}
        </Kartu>
      </section>

      {/* Baris kaki. Kurs adalah asumsi yang menempel di hampir setiap angka
          di halaman ini, jadi dia disebut sekali di bawah, bukan diulang di
          tiap kartu. */}
      <p className="label-mikro border-t border-bordr pt-3 text-center">
        Kurs dipakai · 1 USD = {formatUang(kurs.usdIdr, "IDR")}
        {kurs.diperbaruiPada ? ` · ${selangWaktu(kurs.diperbaruiPada)}` : " · manual"}
      </p>
    </div>
  );
}

function KerangkaMuat() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rangka h-64 lg:col-span-2" />
        <div className="rangka h-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="rangka h-24" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rangka h-72 lg:col-span-2" />
        <div className="rangka h-72" />
      </div>
    </div>
  );
}
