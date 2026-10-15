"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Grup form berupa kartu dengan judul yang bisa dilipat (expandable).
 * Isi tetap ter-mount saat dilipat (hanya disembunyikan) supaya field tetap ikut terkirim bersama form.
 */
export default function Section({
  title,
  subtitle,
  right,
  defaultOpen = true,
  flush = false,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  /** Konten di ujung kanan header (mis. total), tidak ikut memicu lipat/buka. */
  right?: React.ReactNode;
  defaultOpen?: boolean;
  /** Isi tanpa padding (mis. tabel yang melebar penuh). */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`card ${className}`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 ${open ? "border-b border-slate-100" : ""}`}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${open ? "" : "-rotate-90"}`} />
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <span className="truncate text-xs font-normal text-slate-400">{subtitle}</span>}
        </button>
        {right}
      </div>
      {/* Field di dalam grup yang terlipat dan tidak valid: buka otomatis supaya pesan validasi terlihat. */}
      <div id={id} hidden={!open} onInvalidCapture={() => setOpen(true)} className={flush ? "" : "p-5"}>
        {children}
      </div>
    </section>
  );
}
