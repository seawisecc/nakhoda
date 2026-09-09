"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Bidang, Isian, Tombol } from "@/components/ui/dasar";
import { Merek } from "./logo";
import { useData } from "@/lib/data/penyedia";

export function LayarMasuk() {
  const { masuk, galatAuth } = useData();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    try {
      await masuk(email, sandi);
    } catch {
      // Pesan galat sudah disiapkan oleh penyedia data.
    } finally {
      setSibuk(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <Merek className="mb-8 justify-center" />
        <form onSubmit={kirim} className="kartu space-y-4 p-6">
          <div>
            <h1 className="font-mono text-[15px] font-semibold tracking-tight text-ink uppercase">Masuk</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
              Nakhoda menyimpan data finansial pribadi, jadi aksesnya dikunci.
              Hanya akun yang terdaftar di project Firebase ini yang bisa masuk.
            </p>
          </div>

          <Bidang label="Email">
            <Isian
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </Bidang>

          <Bidang label="Kata sandi">
            <Isian
              type="password"
              autoComplete="current-password"
              required
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="••••••••"
            />
          </Bidang>

          {galatAuth ? (
            <p className="border border-turun/25 bg-turun-lembut px-3 py-2 text-[13px] text-turun">
              {galatAuth}
            </p>
          ) : null}

          <Tombol type="submit" rupa="utama" ukuran="besar" className="w-full" disabled={sibuk}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : null}
            {sibuk ? "Memeriksa" : "Masuk"}
          </Tombol>
        </form>
      </div>
    </main>
  );
}
