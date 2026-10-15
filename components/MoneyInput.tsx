"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const fmt = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Input nominal rupiah dengan pemisah ribuan otomatis saat mengetik (1000000 → 1.000.000).
 * Nilai mentah (angka saja) dikirim lewat input tersembunyi bernama `name`.
 */
export default function MoneyInput({ name, defaultValue = 0, maxDigits = 12, className = "", onChange }: { name?: string; defaultValue?: number; maxDigits?: number; className?: string; onChange?: (digits: string) => void }) {
  const initial = String(Math.max(0, Math.round(defaultValue)));
  const [digits, setDigits] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);

  // Discard / form.reset() mengembalikan nilai awal.
  useEffect(() => {
    const form = inputRef.current?.closest("form");
    if (!form) return;
    const reset = () => setDigits(initial);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initial]);

  // Setelah diformat ulang, kembalikan kursor ke posisi digit yang sama.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || caretDigits.current === null) return;
    let seen = 0;
    let pos = 0;
    const text = el.value;
    while (pos < text.length && seen < caretDigits.current) {
      if (/\d/.test(text[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [digits]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 money-prefix">Rp</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={fmt(digits)}
        onChange={(e) => {
          const raw = e.target.value;
          caretDigits.current = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/\D/g, "").length;
          const next = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxDigits) || "0";
          setDigits(next);
          onChange?.(next);
        }}
        onFocus={(e) => e.target.select()}
        className={`input money-input pl-9 ${className}`}
      />
      {name && <input type="hidden" name={name} value={digits} />}
    </div>
  );
}
