"use client";

import { useEffect, useRef, useState } from "react";
import NumericInput from "./NumericInput";

/** Isian durasi (menit) untuk <form>: input angka + nilai dikirim lewat `name`. Mengikuti Discard (reset form). */
export default function DurationField({ name = "duration_minutes", defaultValue = 30 }: { name?: string; defaultValue?: number }) {
  const [v, setV] = useState(String(defaultValue));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const reset = () => setTimeout(() => setV(String(defaultValue)), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);
  return (
    <div ref={ref}>
      <NumericInput name={name} maxDigits={4} value={v} onChange={setV} required placeholder="30" />
    </div>
  );
}
