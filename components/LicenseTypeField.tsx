"use client";

import { useEffect, useRef, useState } from "react";
import LicenseTypeCards from "./LicenseTypeCards";

/** Kartu tipe lisensi + slot (mis. kolom harga). Discard / form.reset() mengembalikan nilai awal. */
export default function LicenseTypeField({ license, children }: { license: string; children?: React.ReactNode }) {
  const [lic, setLic] = useState(license);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const reset = () => setTimeout(() => setLic(license), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [license]);

  return (
    <div ref={wrapRef} className="space-y-4">
      <div>
        <div className="label">Tipe lisensi</div>
        <LicenseTypeCards value={lic} onChange={setLic} />
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">{children}</div>
    </div>
  );
}
