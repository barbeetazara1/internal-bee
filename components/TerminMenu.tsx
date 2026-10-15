"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ReceiptText } from "lucide-react";
import { Badge } from "./ui";

export type Termin = { id: string; code: string; product: string; kind: string; no: number; of: number; amount: string; due: string; status: string; statusLabel: string; tone: "green" | "amber" | "red" | "slate"; invoiceHref: string };

/** Tombol "Termin Invoice": daftar termin pembayaran bertahap sebuah project, masing-masing menuju invoice-nya. */
export default function TerminMenu({ items }: { items: Termin[] }) {
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

  const byProduct = [...new Set(items.map((i) => i.product))];
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <ReceiptText size={15} /> Termin Invoice <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 w-[26rem] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">Pilih termin untuk membuka invoice-nya</div>
          <div className="max-h-96 overflow-y-auto py-1">
            {byProduct.map((p) => (
              <div key={p}>
                {byProduct.length > 1 && <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{p}</div>}
                {items.filter((i) => i.product === p).map((i) => (
                  <Link key={i.id} href={i.invoiceHref} role="menuitem" onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{i.kind} · {i.no} dari {i.of}</span>
                      <span className="block text-xs text-slate-500">{i.code} · jatuh tempo {i.due}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-medium">{i.amount}</span>
                      <Badge tone={i.tone}>{i.statusLabel}</Badge>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
