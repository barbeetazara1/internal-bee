"use client";

import { useEffect, useRef, useState } from "react";
import LicenseTypeCards from "./LicenseTypeCards";

/** Pilihan periode tagih add-on berbentuk kartu (Bulanan / Tahunan / One-time). Discard / form.reset() mengembalikan nilai awal. */
export default function AddonBillingField({ billing }: { billing: string }) {
  const [v, setV] = useState(billing);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const reset = () => setTimeout(() => setV(billing), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [billing]);
  return (
    <div ref={wrapRef}>
      <div className="label">Periode tagih<span className="text-red-500"> *</span></div>
      <LicenseTypeCards name="billing" value={v} onChange={setV} ariaLabel="Periode tagih" />
    </div>
  );
}
