"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Layers } from "lucide-react";
import { Badge } from "./ui";

export type InvoiceGroup = { key: string; due: string; count: number; total: string; statusLabel: string; tone: "green" | "amber" | "red" | "slate"; href: string; items: string[] };

/** Tombol "Invoice Gabungan": tagihan project yang jatuh tempo di hari yang sama dikelompokkan, masing-masing menuju satu invoice. */
export default function InvoiceGroupMenu({ groups }: { groups: InvoiceGroup[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Layers size={15} /> Invoice Gabungan <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 w-[26rem] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">Tagihan yang jatuh tempo di hari yang sama digabung dalam satu invoice</div>
          <div className="max-h-96 overflow-y-auto py-1">
            {groups.map((g) => (
              <Link key={g.key} href={g.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">{`Jatuh tempo ${g.due} · ${g.count} tagihan`}</span>
                  <span className="block truncate text-xs text-slate-500">{g.items.join(" · ")}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-medium">{g.total}</span><Badge tone={g.tone}>{g.statusLabel}</Badge></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
