"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Opt } from "./Select";

/**
 * Pilihan banyak (many2many) bergaya Select: nilai terpilih tampil sebagai chip; dropdown berisi daftar dengan centang
 * (tetap terbuka saat memilih). Setiap nilai dikirim lewat <input type="hidden" name={name}> sendiri, sehingga
 * `FormData.getAll(name)` mengembalikan semuanya. Bisa dipakai tanpa form (controlled lewat `value`/`onChange`).
 */
export default function MultiSelect({
  name, options, defaultValue = [], value, onChange, placeholder = "Pilih…", emptyText = "Tidak ada pilihan", locked, className = "",
}: {
  name?: string; options: Opt[]; defaultValue?: string[]; value?: string[]; onChange?: (v: string[]) => void;
  placeholder?: string; emptyText?: string; locked?: boolean; className?: string;
}) {
  const [inner, setInner] = useState<string[]>(defaultValue);
  const sel = value ?? inner;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, up: false });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const showSearch = options.length > 7;

  // Discard / form.reset() mengembalikan nilai awal.
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const reset = () => setInner(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue.join(",")]);

  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  function toggle(v: string) {
    const next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
    setInner(next);
    onChange?.(next);
  }
  function openMenu() {
    const btn = btnRef.current;
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom;
    setPos({ top: up ? r.top : r.bottom, left: r.left, width: Math.max(r.width, 220), up });
    setQ("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const scroll = (e: Event) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    const resize = () => setOpen(false);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative block ${className}`}>
      <button
        ref={btnRef}
        type="button"
        data-select
        data-locked={locked ? "1" : undefined}
        disabled={locked}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="input flex min-h-[2.25rem] items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {sel.length === 0 ? (
            <span className="ms-empty text-slate-400">{placeholder}</span>
          ) : (
            sel.map((v) => (
              <span key={v} className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-inset ring-amber-300/60">
                {label(v)}
              </span>
            ))
          )}
        </span>
        <ChevronDown size={15} className={`select-chevron shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {name && sel.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-multiselectable="true"
            style={{ position: "fixed", left: pos.left, minWidth: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }) }}
            className="z-[95] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xl"
          >
            {showSearch && (
              <div className="relative border-b border-slate-100 p-2">
                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" className="input !py-1 pl-8 text-sm" autoFocus />
              </div>
            )}
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">{emptyText}</li>}
              {filtered.map((o) => {
                const on = sel.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(o.value)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-100 ${on ? "font-medium text-amber-600" : "text-slate-700"}`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-amber-500 bg-amber-400 text-slate-900" : "border-slate-300"}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
