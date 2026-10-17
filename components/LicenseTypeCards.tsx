"use client";

import { CalendarDays, CalendarRange, Zap, type LucideIcon } from "lucide-react";

const CARDS: { value: string; label: string; desc: string; Icon: LucideIcon }[] = [
  { value: "YEARLY", label: "Tahunan", desc: "Ditagih dan diperpanjang setiap tahun", Icon: CalendarRange },
  { value: "MONTHLY", label: "Bulanan", desc: "Ditagih dan diperpanjang setiap bulan", Icon: CalendarDays },
  { value: "ONE_TIME", label: "One-time", desc: "Bayar sekali, tanpa perpanjangan", Icon: Zap },
];

/**
 * Pilihan tipe lisensi berbentuk kartu (radio). Memakai <input type="radio"> sungguhan supaya ikut
 * terkunci di mode baca dan ikut dikirim bersama form.
 */
export default function LicenseTypeCards({ name = "license_type", value, onChange, ariaLabel = "Tipe lisensi" }: { name?: string; value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {CARDS.map(({ value: v, label, desc, Icon }) => (
        <label key={v} className="relative block cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
          <span className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-surface p-4 transition hover:border-slate-300 peer-checked:border-amber-400 peer-checked:bg-amber-400/15 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300 peer-disabled:cursor-default peer-disabled:opacity-60 peer-disabled:hover:border-slate-200 peer-disabled:peer-checked:hover:border-amber-400">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{label}</span>
              <span className="block text-sm text-slate-500">{desc}</span>
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
