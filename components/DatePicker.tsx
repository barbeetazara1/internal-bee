"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "./I18nProvider";

const MONTHS = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const SHORT = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const WEEK = { id: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const TEXT = { id: { today: "Hari ini", clear: "Hapus", pick: "Pilih tanggal…", prev: "Bulan sebelumnya", next: "Bulan berikutnya" }, en: { today: "Today", clear: "Clear", pick: "Select date…", prev: "Previous month", next: "Next month" } };

const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Pemilih tanggal buatan sendiri (pengganti <input type="date"> bawaan browser), tampil dan berperilaku seperti Select:
 * tombol + popup kalender. Nilai berformat YYYY-MM-DD, dikirim lewat input tersembunyi bernama `name`
 * (ikut FormData dan validasi `required`).
 */
export default function DatePicker({
  name, value, defaultValue = "", min, max, required, locked, placeholder, className = "", onChange,
}: {
  name?: string; value?: string; defaultValue?: string; min?: string; max?: string; required?: boolean;
  /** Selalu readonly, tidak ikut diaktifkan oleh mode edit. */
  locked?: boolean; placeholder?: string; className?: string; onChange?: (value: string) => void;
}) {
  const { lang } = useLang();
  const L = lang === "en" ? "en" : "id";
  const [inner, setInner] = useState(defaultValue);
  const val = value ?? inner;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(val) ?? new Date()); // bulan yang ditampilkan
  const [cursor, setCursor] = useState<Date>(() => parse(val) ?? new Date()); // hari yang difokus keyboard
  const [pos, setPos] = useState({ top: 0, left: 0, up: false });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = parse(val);
  const minD = parse(min);
  const maxD = parse(max);
  const today = new Date();
  const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const disabled = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);

  // Discard / form.reset() mengembalikan nilai awal.
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const reset = () => setInner(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  function openPop() {
    const btn = btnRef.current;
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 360 && r.top > window.innerHeight - r.bottom;
    setPos({ top: up ? r.top : r.bottom, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)), up });
    const base = selected ?? todayD;
    setView(base);
    setCursor(base);
    setOpen(true);
  }
  function close(focus = false) {
    setOpen(false);
    if (focus) btnRef.current?.focus();
  }
  function choose(d: Date | null) {
    if (d && disabled(d)) return;
    const s = d ? toStr(d) : "";
    setInner(s);
    onChange?.(s);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    popRef.current?.focus();
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const scroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
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
  }, [open]);

  function moveCursor(d: Date) {
    setCursor(d);
    setView(d);
  }
  function onPopKey(e: React.KeyboardEvent) {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); close(true); }
    else if (k === "ArrowLeft") { e.preventDefault(); moveCursor(addDays(cursor, -1)); }
    else if (k === "ArrowRight") { e.preventDefault(); moveCursor(addDays(cursor, 1)); }
    else if (k === "ArrowUp") { e.preventDefault(); moveCursor(addDays(cursor, -7)); }
    else if (k === "ArrowDown") { e.preventDefault(); moveCursor(addDays(cursor, 7)); }
    else if (k === "PageUp") { e.preventDefault(); moveCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, cursor.getDate())); }
    else if (k === "PageDown") { e.preventDefault(); moveCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())); }
    else if (k === "Enter") { e.preventDefault(); choose(cursor); }
    else if (k === "Tab") setOpen(false);
  }

  // 6 minggu penuh, mulai Senin
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  }, [view]);

  const label = selected ? `${selected.getDate()} ${SHORT[L][selected.getMonth()]} ${selected.getFullYear()}` : null;

  return (
    <div ref={wrapRef} data-no-i18n className={`relative block ${className}`}>
      <button
        ref={btnRef}
        type="button"
        data-select
        data-locked={locked ? "1" : undefined}
        disabled={locked}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPop())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPop();
          }
        }}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${label ? "" : "text-slate-400"}`}>{label ?? placeholder ?? TEXT[L].pick}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-400" />
      </button>
      {name && <input name={name} value={val} onChange={() => {}} required={required} tabIndex={-1} aria-hidden style={{ opacity: 0 }} className="pointer-events-none absolute inset-0 h-full w-full" />}
      {open &&
        createPortal(
          <div
            ref={popRef}
            data-no-i18n
            role="dialog"
            aria-label={`${MONTHS[L][view.getMonth()]} ${view.getFullYear()}`}
            tabIndex={-1}
            onKeyDown={onPopKey}
            style={{ position: "fixed", left: pos.left, width: 288, ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }) }}
            className="z-[90] rounded-xl border border-slate-200 bg-surface p-3 shadow-xl outline-none"
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label={TEXT[L].prev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
              <div className="text-sm font-semibold text-slate-800">{MONTHS[L][view.getMonth()]} {view.getFullYear()}</div>
              <button type="button" aria-label={TEXT[L].next} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
              {WEEK[L].map((w) => <div key={w} className="py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((d) => {
                const inMonth = d.getMonth() === view.getMonth();
                const isSel = !!selected && toStr(d) === toStr(selected);
                const isToday = toStr(d) === toStr(todayD);
                const off = disabled(d);
                return (
                  <button
                    key={toStr(d)}
                    type="button"
                    tabIndex={-1}
                    disabled={off}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(d)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                      isSel ? "bg-amber-400 font-semibold text-slate-900" : off ? "cursor-not-allowed text-slate-300 line-through" : inMonth ? "text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-100"
                    } ${isToday && !isSel ? "ring-1 ring-amber-400" : ""} ${toStr(d) === toStr(cursor) && !isSel ? "bg-slate-100" : ""}`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <button type="button" disabled={disabled(todayD)} onClick={() => choose(todayD)} className="rounded-lg px-2 py-1 font-medium text-amber-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent">{TEXT[L].today}</button>
              {!required && <button type="button" onClick={() => choose(null)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">{TEXT[L].clear}</button>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
