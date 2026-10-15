"use client";

import { useEffect, useRef, useState } from "react";
import { consumeKeyFlash } from "@/app/actions/keys";
import type { RevealedKey } from "@/lib/flash";

/** One-Time Key Display: plaintext key hanya muncul sekali, lalu hilang dari server. */
export default function KeyReveal() {
  const [keys, setKeys] = useState<RevealedKey[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    consumeKeyFlash().then(setKeys);
  }, []);

  if (keys.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <div className="mb-1 font-semibold text-amber-900">API Key baru — salin sekarang</div>
      <p className="mb-3 text-sm text-amber-800">
        Key ini hanya ditampilkan <b>satu kali</b>. Di database hanya tersimpan hash SHA-256, sehingga tidak dapat dipulihkan setelah halaman ini ditutup.
      </p>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.key} className="rounded-lg border border-amber-200 bg-surface p-3">
            <div className="mb-1 text-xs text-slate-500">
              {k.product} · {k.environment}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-[#0f172a] px-2 py-1.5 font-mono text-xs text-amber-300">{k.key}</code>
              <button
                className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(k.key);
                  setCopied(k.key);
                }}
              >
                {copied === k.key ? "Tersalin ✓" : "Salin"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-sm mt-3" onClick={() => setKeys([])}>
        Saya Sudah Menyimpannya
      </button>
    </div>
  );
}
