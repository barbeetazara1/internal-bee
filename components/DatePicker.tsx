"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
const TEXT = {
  id: { today: "Hari ini", now: "Sekarang", ok: "OK", clear: "Hapus", pick: "Pilih tanggal…", pickTime: "Pilih tanggal & waktu…", prev: "Bulan sebelumnya", next: "Bulan berikutnya", hour: "Jam", minute: "Menit" },
  en: { today: "Today", now: "Now", ok: "OK", clear: "Clear", pick: "Select date…", pickTime: "Select date & time…", prev: "Previous month", next: "Next month", hour: "Hour", minute: "Minute" },
};

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
 *
 * Dengan `time`, tanggal DAN waktu dipilih dalam satu widget (kalender + kolom jam & menit). Nilainya string ISO UTC
 * (mis. 2026-10-17T07:30:00.000Z) dari waktu lokal pengguna, supaya server di zona waktu mana pun membacanya sama.
 */
export default function DatePicker({
  name, value, defaultValue = "", min, max, required, locked, placeholder, className = "", onChange, time = false,
}: {
  time?: boolean;
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

  const selected = time ? (val ? (Number.isNaN(new Date(val).getTime()) ? null : new Date(val)) : null) : parse(val);
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
    setPos({ top: up ? r.top : r.bottom, left: Math.max(8, Math.min(r.left, window.innerWidth - (time ? 420 : 296))), up });
    const base = selected ?? todayD;
    setView(base);
    setCursor(base);
    setOpen(true);
  }
  function close(focus = false) {
    setOpen(false);
    if (focus) btnRef.current?.focus();
  }
  const emit = (d: Date | null) => {
    const s = d ? (time ? d.toISOString() : toStr(d)) : "";
    setInner(s);
    onChange?.(s);
  };
  const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function choose(d: Date | null) {
    if (d && disabled(dayOnly(d))) return;
    if (!time) {
      emit(d);
      close(true);
      return;
    }
    // Mode waktu: memilih hari mempertahankan jam yang sudah ada (default: jam penuh berikutnya / 09:00), popup tetap terbuka
    if (!d) {
      emit(null);
      close(true);
      return;
    }
    const base = selected ?? new Date(new Date().getTime() + 3600000);
    const h = selected ? selected.getHours() : toStr(dayOnly(d)) === toStr(todayD) ? base.getHours() : 9;
    const m = selected ? selected.getMinutes() : 0;
    emit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
  }
  function setTimePart(h: number, m: number) {
    const base = selected ?? dayOnly(new Date());
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
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
    else if (k === "Enter") { e.preventDefault(); choose(time && selected ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), selected.getHours(), selected.getMinutes()) : cursor); }
    else if (k === "Tab") setOpen(false);
  }

  // 6 minggu penuh, mulai Senin
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  }, [view]);

  const label = selected ? `${selected.getDate()} ${SHORT[L][selected.getMonth()]} ${selected.getFullYear()}${time ? `, ${pad(selected.getHours())}:${pad(selected.getMinutes())}` : ""}` : null;

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
        <span className={`truncate ${label ? "" : "text-slate-400"}`}>{label ?? placeholder ?? (time ? TEXT[L].pickTime : TEXT[L].pick)}</span>
        {time ? <CalendarClock size={15} className="select-chevron shrink-0 text-slate-400" /> : <CalendarDays size={15} className="select-chevron shrink-0 text-slate-400" />}
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
            style={{ position: "fixed", left: pos.left, width: time ? 412 : 288, ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }) }}
            className="z-[90] rounded-xl border border-slate-200 bg-surface p-3 shadow-xl outline-none"
          >
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
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
              </div>
              {time && (
                <div className="flex w-[112px] shrink-0 gap-1 border-l border-slate-100 pl-3" aria-label={`${TEXT[L].hour} / ${TEXT[L].minute}`}>
                  {[
                    { key: "h", label: TEXT[L].hour, items: Array.from({ length: 24 }, (_, i) => i), cur: selected?.getHours() },
                    { key: "m", label: TEXT[L].minute, items: Array.from({ length: 12 }, (_, i) => i * 5), cur: selected ? Math.floor(selected.getMinutes() / 5) * 5 : undefined },
                  ].map((col) => (
                    <div key={col.key} className="min-w-0 flex-1">
                      <div className="mb-1 text-center text-xs font-medium text-slate-400">{col.label}</div>
                      <div className="h-[252px] overflow-y-auto pr-0.5" data-timecol={col.key} ref={(el) => { if (el && open) { const sel = el.querySelector<HTMLElement>("[data-on]"); if (sel) el.scrollTop = Math.max(0, sel.offsetTop - 100); } }}>
                        {col.items.map((n) => {
                          const on = col.cur === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              tabIndex={-1}
                              data-on={on ? "1" : undefined}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => (col.key === "h" ? setTimePart(n, selected?.getMinutes() ?? 0) : setTimePart(selected?.getHours() ?? 9, n))}
                              className={`mb-0.5 block w-full rounded-md py-1 text-center text-sm transition ${on ? "bg-amber-400 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}
                            >
                              {pad(n)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <button
                type="button"
                disabled={disabled(todayD)}
                onClick={() => {
                  if (!time) return choose(todayD);
                  const n = new Date(); // "Sekarang": hari ini dengan jam & menit saat ini (dibulatkan 5 menit)
                  emit(new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), Math.round(n.getMinutes() / 5) * 5 % 60));
                  setView(n);
                  setCursor(n);
                }}
                className="rounded-lg px-2 py-1 font-medium text-amber-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                {time ? TEXT[L].now : TEXT[L].today}
              </button>
              <span className="flex items-center gap-1">
                {!required && <button type="button" onClick={() => choose(null)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">{TEXT[L].clear}</button>}
                {time && <button type="button" onClick={() => close(true)} className="rounded-lg bg-amber-400 px-3 py-1 font-semibold text-slate-900 hover:bg-amber-300">{TEXT[L].ok}</button>}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
