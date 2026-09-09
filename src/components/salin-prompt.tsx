"use client";

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { PROMPT_SARAN } from "@/lib/prompt-saran";
import { Tombol } from "@/components/ui/dasar";

/** Tombol salin prompt riset. Sengaja cuma tombol.
 *
 *  Pendahulunya menampilkan seluruh teks perintah di dalam panel besar dengan
 *  penjelasan di atasnya. Teks itu tidak pernah dibaca di layar, cuma disalin,
 *  jadi yang dilakukannya hanya mendorong isi halaman yang benar-benar dipakai
 *  turun beberapa ratus piksel. */
export function SalinPrompt() {
  const [tersalin, setTersalin] = useState(false);
  const [gagal, setGagal] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(PROMPT_SARAN);
      setGagal(false);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard ditolak browser terjadi di konteks tidak aman dan di sebagian
      // browser dalam mode privat. Dikatakan apa adanya, bukan diam-diam gagal
      // sambil tetap menampilkan centang seolah berhasil.
      setGagal(true);
    }
  }

  return (
    <Tombol onClick={salin} title="Salin prompt riset untuk ditempel ke terminal">
      {tersalin ? <Check size={15} /> : <ClipboardCopy size={15} />}
      {gagal ? "Gagal menyalin" : tersalin ? "Tersalin" : "Salin prompt"}
    </Tombol>
  );
}
