"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export type Opt = { value: string; label: string };

/**
 * Dropdown pengganti <select> bawaan browser. Nilai dikirim lewat input tersembunyi bernama `name`
 * sehingga tetap bekerja di <form>/FormData (termasuk validasi `required`).
 */
export default function Select({
  name,
  options,
  defaultValue = "",
  placeholder = "Select…",
  required,
  className = "",
  searchable,
  locked,
  onChange,
}: {
  name?: string;
  options: Opt[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  searchable?: boolean;
  /** Selalu readonly, tidak ikut diaktifkan oleh mode edit. */
  locked?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, up: false });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 7;
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);

  // Discard / form.reset() mengembalikan ke nilai awal.
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const reset = () => setValue(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  function openMenu() {
    const btn = btnRef.current;
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 280 && r.top > below;
    setPos({ top: up ? r.top : r.bottom, left: r.left, width: Math.max(r.width, 180), up });
    setQ("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close(focus = false) {
    setOpen(false);
    if (focus) btnRef.current?.focus();
  }

  function choose(o: Opt) {
    setValue(o.value);
    onChange?.(o.value);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const scroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("mousedown", down);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open, showSearch]);

  // Pastikan item aktif selalu terlihat saat navigasi keyboard.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className.includes("w-auto") ? "inline-block" : "block"}`}>
      <button
        ref={btnRef}
        type="button"
        data-select
        data-locked={locked ? "1" : undefined}
        disabled={locked}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${selected && selected.value !== "" ? "" : "text-slate-400"}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} className={`select-chevron shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {name && (
        // Input transparan di atas tombol: membawa nilai ke FormData dan memicu validasi `required`.
        <input name={name} value={value} onChange={() => {}} required={required} tabIndex={-1} aria-hidden style={{ opacity: 0 }} className="pointer-events-none absolute inset-0 h-full w-full" />
      )}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: "fixed", left: pos.left, minWidth: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }) }}
            className="z-[90] max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xl"
          >
            {showSearch && (
              <div className="relative border-b border-slate-100 p-2">
                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKey}
                  placeholder="Search…"
                  className="input !py-1 pl-8 text-sm"
                />
              </div>
            )}
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No results</li>}
              {filtered.map((o, i) => (
                <li key={o.value} role="option" aria-selected={o.value === value} data-idx={i}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${i === active ? "bg-slate-100" : ""} ${o.value === value ? "font-medium text-amber-600" : "text-slate-700"}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && <Check size={14} className="shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
