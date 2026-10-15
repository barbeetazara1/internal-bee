"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, KeyRound, type LucideIcon } from "lucide-react";

/** Item berupa tautan (href) atau aksi (id, ditangani onSelect). */
export type MenuItem = { label: string; href?: string; id?: string; icon?: "document" | "key" };
const ICONS: Record<string, LucideIcon> = { document: FileText, key: KeyRound };

/** Tombol "More Actions" berisi dropdown aksi untuk sebuah record (mis. Generate Quotation / Invoice). */
export default function ActionsMenu({ items, onSelect }: { items: MenuItem[]; onSelect?: (id: string) => void }) {
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
        More Actions <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 min-w-64 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lg">
          {items.map((it) => {
            const Icon = it.icon ? ICONS[it.icon] : null;
            const cls = "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";
            const content = (<>{Icon && <Icon size={15} className="text-slate-400" />} {it.label}</>);
            return it.href ? (
              <Link key={it.label} href={it.href} role="menuitem" onClick={() => setOpen(false)} className={cls}>{content}</Link>
            ) : (
              <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); if (it.id) onSelect?.(it.id); }} className={cls}>{content}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
