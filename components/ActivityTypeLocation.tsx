"use client";

import { useEffect, useRef, useState } from "react";
import Select from "./Select";

/**
 * Pilihan Activity Type + (bila jenisnya butuh tempat) isian Lokasi Detail yang wajib, untuk form Activity.
 * `status` = node field Status yang ditempatkan di samping Activity Type.
 */
export default function ActivityTypeLocation({
  types, defaultType, defaultLocation, status,
}: { types: { id: string; name: string; needs_location: boolean }[]; defaultType: string; defaultLocation: string; status: React.ReactNode }) {
  const [typeId, setTypeId] = useState(defaultType);
  const [location, setLocation] = useState(defaultLocation);
  const ref = useRef<HTMLDivElement>(null);
  const needs = !!types.find((t) => t.id === typeId)?.needs_location;

  // Discard mengembalikan nilai awal
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const reset = () => setTimeout(() => { setTypeId(defaultType); setLocation(defaultLocation); }, 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultType, defaultLocation]);

  return (
    <>
      <div ref={ref}>
        <label className="label">Activity Type<span className="text-red-500"> *</span></label>
        <Select key={typeId} name="type_id" required options={types.map((t) => ({ value: t.id, label: t.name }))} defaultValue={typeId} onChange={setTypeId} />
      </div>
      <div>{status}</div>
      {needs && (
        <div className="sm:col-span-2">
          <label className="label">Lokasi Detail<span className="text-red-500"> *</span></label>
          <input name="location" required maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="Mis. Kantor client, Jl. Sudirman 12 / Zoom" />
        </div>
      )}
    </>
  );
}
