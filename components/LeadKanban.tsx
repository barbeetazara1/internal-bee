"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { LEAD_LABEL, LEAD_STATUSES } from "@/lib/constants";
import { idr } from "@/lib/format";

export type KanbanLead = { id: string; title: string; client: string; contact: string; owner: string; status: string; value: number; products: number; created: string };

const DOT: Record<string, string> = {
  NEW: "bg-slate-400", CONTACTED: "bg-sky-500", QUALIFIED: "bg-violet-500", PROPOSAL: "bg-amber-500",
  NEGOTIATION: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-red-500",
};
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Tampilan Kanban lead per status. Hanya-baca: status diubah di dalam form record, bukan dengan drag. */
export default function LeadKanban({ leads }: { leads: KanbanLead[] }) {
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("topbar-search")), []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? leads.filter((l) => [l.title, l.client, l.contact, l.owner].some((t) => t.toLowerCase().includes(n))) : leads;
  }, [leads, q]);

  const search = (
    <div className="relative w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari lead, client, kontak…" className="input !rounded-full !py-1.5 pl-9 pr-8" aria-label="Cari lead" />
      {q && (
        <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Hapus pencarian">
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div>
      {slot ? createPortal(search, slot) : <div className="mb-3">{search}</div>}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((s) => {
          const col = filtered.filter((l) => l.status === s);
          const total = col.reduce((a, l) => a + l.value, 0);
          return (
            <section key={s} aria-label={LEAD_LABEL[s]} className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-100/60 p-3">
              <header className="mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {LEAD_LABEL[s]}
                  <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{col.length}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{idr(total)}</div>
              </header>
              <div className="space-y-2">
                {col.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">Tidak ada lead</div>}
                {col.map((l) => (
                  <Link key={l.id} href={`/leads/${l.id}`} className="block rounded-lg border border-slate-200 bg-surface p-3 shadow-sm transition hover:border-amber-300 hover:shadow">
                    <div className="mb-1 text-sm font-medium leading-snug">{l.title}</div>
                    <div className="text-xs text-slate-500">{l.client}</div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{idr(l.value)}</span>
                      <span className="text-slate-400">{l.products} produk</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-900" title={l.owner}>{initials(l.owner)}</span>
                        {l.owner}
                      </span>
                      <span>{l.created}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
