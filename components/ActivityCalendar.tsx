"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import ActivityIcon from "./ActivityIcon";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { ACTIVITY_STATE_TONE, activityState, type ActivityState } from "@/lib/when";
import type { ActivityRow } from "./ActivityList";

type Scale = "month" | "week" | "day" | "year";
type Row = ActivityRow & { start: Date; end: Date };

const MONTHS = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONTHS_SHORT = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const DAYS_SHORT = { id: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const DAYS_LONG = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const STAGE = {
  id: { NEW: "Baru", CONTACTED: "Dihubungi", QUALIFIED: "Qualified", PROPOSAL: "Proposal", NEGOTIATION: "Negosiasi", CLOSED_WON: "Closed Won", CLOSED_LOST: "Closed Lost" } as Record<string, string>,
  en: { NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", PROPOSAL: "Proposal", NEGOTIATION: "Negotiation", CLOSED_WON: "Closed Won", CLOSED_LOST: "Closed Lost" } as Record<string, string>,
};
const TEXT = {
  id: {
    scale: { month: "Bulan", week: "Minggu", day: "Hari", year: "Tahun" }, today: "Hari ini", prev: "Sebelumnya", next: "Berikutnya", more: "lagi",
    none: "Tidak ada activity di tanggal ini", countMonth: "activity bulan ini", countWeek: "activity minggu ini", countDay: "activity hari ini", countYear: "activity tahun ini",
    open: "Buka activity", min: "menit", type: "Activity Type", lead: "Lead", stage: "Tahap", activities: "activity", mini: "Mini kalender", detail: "Detail tanggal",
    state: { PLANNED: "Terjadwal", OVERDUE: "Terlambat", DONE: "Selesai" } as Record<ActivityState, string>,
  },
  en: {
    scale: { month: "Month", week: "Week", day: "Day", year: "Year" }, today: "Today", prev: "Previous", next: "Next", more: "more",
    none: "No activities on this date", countMonth: "activities this month", countWeek: "activities this week", countDay: "activities today", countYear: "activities this year",
    open: "Open activity", min: "min", type: "Activity Type", lead: "Lead", stage: "Stage", activities: "activities", mini: "Mini calendar", detail: "Date details",
    state: { PLANNED: "Planned", OVERDUE: "Overdue", DONE: "Done" } as Record<ActivityState, string>,
  },
};

const HOUR_PX = 44; // tinggi satu jam pada timeline minggu/hari
const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // Senin
const monthGrid = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - ((first.getDay() + 6) % 7)));
};
/** Pindah N bulan/tahun dengan menjaga tanggal (dipotong ke akhir bulan bila perlu). */
const shiftMonths = (d: Date, n: number) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
};

/** Susun blok yang saling tumpang tindih dalam satu hari menjadi kolom berdampingan. */
function layoutDay(list: Row[]) {
  const evs = list.map((a) => {
    const s = a.start.getHours() * 60 + a.start.getMinutes();
    return { a, s, e: Math.min(1440, Math.max(s + a.duration, s + 20)), col: 0, cols: 1 };
  });
  evs.sort((x, y) => x.s - y.s);
  let cluster: typeof evs = [];
  let clusterEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const ev of cluster) {
      let c = ends.findIndex((end) => end <= ev.s);
      if (c < 0) c = ends.length;
      ends[c] = ev.e;
      ev.col = c;
    }
    for (const ev of cluster) ev.cols = ends.length;
    cluster = [];
  };
  for (const ev of evs) {
    if (cluster.length && ev.s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  if (cluster.length) flush();
  return evs;
}

const isLate = (a: ActivityRow) => activityState(a) === "OVERDUE";

/**
 * Mode Calendar menu Activity: skala Bulan / Minggu / Hari / Tahun, mini kalender, dan panel detail tanggal terpilih.
 * Semua teks dilokalkan sendiri (komponen ini dikecualikan dari penerjemah otomatis).
 */
export default function ActivityCalendar({ items }: { items: ActivityRow[] }) {
  const { lang } = useLang();
  const L = lang === "en" ? "en" : "id";
  const T = TEXT[L];
  const today = useMemo(() => new Date(), []);
  const todayDay = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);
  const [scale, setScale] = useState<Scale>("month");
  const [selected, setSelected] = useState<Date>(todayDay);
  const [miniMonth, setMiniMonth] = useState<Date>(new Date(todayDay.getFullYear(), todayDay.getMonth(), 1));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mini kalender mengikuti tanggal terpilih
  useEffect(() => setMiniMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)), [selected]);

  const byDay = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const a of items) {
      const start = new Date(a.scheduled_at);
      const row: Row = { ...a, start, end: new Date(start.getTime() + a.duration * 60000) };
      const k = key(start);
      (m.get(k) ?? m.set(k, []).get(k)!).push(row);
    }
    for (const list of m.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());
    return m;
  }, [items]);
  const on = (d: Date) => byDay.get(key(d)) ?? [];

  const weekStart = startOfWeek(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Navigasi mengikuti skala
  const step = (dir: 1 | -1) =>
    setSelected((s) => (scale === "month" ? shiftMonths(s, dir) : scale === "week" ? addDays(s, 7 * dir) : scale === "day" ? addDays(s, dir) : shiftMonths(s, 12 * dir)));

  // Judul + jumlah activity pada rentang yang terlihat
  const title =
    scale === "month"
      ? `${MONTHS[L][selected.getMonth()]} ${selected.getFullYear()}`
      : scale === "year"
        ? String(selected.getFullYear())
        : scale === "day"
          ? `${DAYS_LONG[L][selected.getDay()]}, ${selected.getDate()} ${MONTHS[L][selected.getMonth()]} ${selected.getFullYear()}`
          : (() => {
              const a = weekDays[0], b = weekDays[6];
              return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[L][b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${MONTHS_SHORT[L][a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[L][b.getMonth()]} ${b.getFullYear()}`;
            })();
  const rangeCount = (() => {
    if (scale === "day") return on(selected).length;
    if (scale === "week") return weekDays.reduce((n, d) => n + on(d).length, 0);
    if (scale === "year") return [...byDay.entries()].filter(([k]) => k.startsWith(`${selected.getFullYear()}-`)).reduce((n, [, l]) => n + l.length, 0);
    return monthGrid(selected).filter((d) => d.getMonth() === selected.getMonth()).reduce((n, d) => n + on(d).length, 0);
  })();
  const countLabel = { month: T.countMonth, week: T.countWeek, day: T.countDay, year: T.countYear }[scale];

  // Timeline minggu/hari: gulung ke activity paling awal pada rentang (atau 07:00)
  useEffect(() => {
    if (scale !== "week" && scale !== "day") return;
    const days = scale === "day" ? [selected] : weekDays;
    const mins = days.flatMap((d) => on(d)).map((a) => a.start.getHours() * 60 + a.start.getMinutes());
    const from = mins.length ? Math.max(0, Math.min(...mins) / 60 - 1) : 7;
    if (scrollRef.current) scrollRef.current.scrollTop = from * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, key(scale === "week" ? weekStart : selected)]);

  const select = (d: Date) => setSelected(d);
  const dayList = on(selected);

  /* ---------- tampilan utama ---------- */
  const Chip = ({ a }: { a: Row }) => (
    <span className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight ${isLate(a) ? "bg-red-500/15 text-red-700" : "bg-emerald-500/15 text-emerald-700"} ${a.status === "DONE" ? "opacity-70" : ""}`} title={`${hm(a.start)} ${a.title}`}>
      <b className="shrink-0 font-semibold">{hm(a.start)}</b>
      <span className="truncate">{a.title}</span>
    </span>
  );

  const monthView = (
    <>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {DAYS_SHORT[L].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(selected).map((d, i) => {
          const list = on(d);
          const inMonth = d.getMonth() === selected.getMonth();
          return (
            <button
              key={key(d)}
              type="button"
              onClick={() => select(d)}
              aria-label={`${d.getDate()} ${MONTHS[L][d.getMonth()]} ${d.getFullYear()}${list.length ? `, ${list.length} ${T.activities}` : ""}`}
              aria-pressed={key(d) === key(selected)}
              className={`min-h-[6.5rem] border-b border-slate-100 p-1.5 text-left align-top transition hover:bg-slate-50 ${i % 7 !== 6 ? "border-r" : ""} ${inMonth ? "" : "bg-slate-50/60"} ${key(d) === key(selected) ? "bg-amber-400/10 ring-2 ring-inset ring-amber-400" : ""}`}
            >
              <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${key(d) === key(todayDay) ? "bg-amber-400 font-bold text-slate-900" : inMonth ? "text-slate-700" : "text-slate-400"}`}>{d.getDate()}</span>
              <span className="block space-y-0.5">
                {list.slice(0, 3).map((a) => <Chip key={a.id} a={a} />)}
                {list.length > 3 && <span className="block px-1.5 text-[11px] font-medium text-slate-500">+{list.length - 3} {T.more}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const timeline = (days: Date[]) => (
    <div>
      <div className="grid border-b border-slate-100 bg-slate-50 text-center text-xs" style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <button key={key(d)} type="button" onClick={() => select(d)} aria-pressed={key(d) === key(selected)} className={`border-l border-slate-100 py-2 transition hover:bg-slate-100 ${key(d) === key(selected) ? "bg-amber-400/10" : ""}`}>
            <span className="block font-semibold uppercase tracking-wide text-slate-500">{DAYS_SHORT[L][(d.getDay() + 6) % 7]}</span>
            <span className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${key(d) === key(todayDay) ? "bg-amber-400 text-slate-900" : "text-slate-800"}`}>{d.getDate()}</span>
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="max-h-[36rem] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))`, height: 24 * HOUR_PX }}>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400" style={{ top: h * HOUR_PX }}>{h === 0 ? "" : `${pad(h)}:00`}</div>
            ))}
          </div>
          {days.map((d) => (
            <div key={key(d)} className="relative border-l border-slate-100" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgba(148,163,184,0.25) ${HOUR_PX - 1}px, rgba(148,163,184,0.25) ${HOUR_PX}px)` }}>
              {layoutDay(on(d)).map(({ a, s, e, col, cols }) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(d)}
                  title={`${hm(a.start)}–${hm(a.end)} ${a.title}`}
                  className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition hover:z-10 hover:shadow ${isLate(a) ? "border-red-300 bg-red-500/20 text-red-800" : "border-emerald-300 bg-emerald-500/20 text-emerald-800"} ${a.status === "DONE" ? "opacity-70" : ""}`}
                  style={{ top: (s / 60) * HOUR_PX, height: Math.max(((e - s) / 60) * HOUR_PX - 1, 20), left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 2px)` }}
                >
                  <b className="font-semibold">{hm(a.start)}</b> {a.title}
                  {e - s >= 45 && a.location && <span className="block truncate opacity-80">📍 {a.location}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const yearView = (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {MONTHS[L].map((_, m) => {
        const first = new Date(selected.getFullYear(), m, 1);
        return (
          <div key={m} className="rounded-lg border border-slate-100 p-2">
            <button type="button" onClick={() => { setSelected(new Date(selected.getFullYear(), m, Math.min(selected.getDate(), 28))); setScale("month"); }} className="mb-1 w-full rounded px-1 py-0.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100">{MONTHS[L][m]}</button>
            <div className="grid grid-cols-7 text-center text-[10px] text-slate-400">{DAYS_SHORT[L].map((d) => <div key={d}>{d[0]}</div>)}</div>
            <div className="grid grid-cols-7">
              {monthGrid(first).map((d) => {
                const inM = d.getMonth() === m;
                const list = inM ? on(d) : [];
                const late = list.some(isLate);
                return (
                  <button
                    key={key(d)}
                    type="button"
                    disabled={!inM}
                    onClick={() => select(d)}
                    aria-label={`${d.getDate()} ${MONTHS[L][d.getMonth()]}${list.length ? `, ${list.length} ${T.activities}` : ""}`}
                    className={`relative flex h-7 items-center justify-center rounded text-[11px] ${inM ? "hover:bg-slate-100" : "invisible"} ${key(d) === key(selected) ? "ring-1 ring-amber-400" : ""} ${key(d) === key(todayDay) ? "bg-amber-400 font-bold text-slate-900" : list.length ? (late ? "bg-red-500/15 font-semibold text-red-700" : "bg-emerald-500/15 font-semibold text-emerald-700") : "text-slate-600"}`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ---------- mini kalender (di atas panel detail) ---------- */
  const mini = (
    <div className="border-b border-slate-100 p-3" aria-label={T.mini}>
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label={T.prev} onClick={() => setSelected((s) => shiftMonths(s, -1))} className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronLeft size={15} /></button>
        <div className="text-sm font-semibold text-slate-800">{MONTHS[L][miniMonth.getMonth()]} {miniMonth.getFullYear()}</div>
        <button type="button" aria-label={T.next} onClick={() => setSelected((s) => shiftMonths(s, 1))} className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-400">{DAYS_SHORT[L].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {monthGrid(miniMonth).map((d) => {
          const inM = d.getMonth() === miniMonth.getMonth();
          const list = on(d);
          const isSel = key(d) === key(selected);
          const inWeek = scale === "week" && weekDays.some((w) => key(w) === key(d));
          return (
            <button
              key={key(d)}
              type="button"
              onClick={() => select(d)}
              aria-label={`${d.getDate()} ${MONTHS[L][d.getMonth()]} ${d.getFullYear()}${list.length ? `, ${list.length} ${T.activities}` : ""}`}
              aria-pressed={isSel}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition ${isSel ? "bg-amber-400 font-bold text-slate-900" : key(d) === key(todayDay) ? "ring-1 ring-amber-400 text-slate-900" : inM ? "text-slate-700 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-100"} ${inWeek && !isSel ? "bg-amber-400/15" : ""}`}
            >
              {d.getDate()}
              {list.length > 0 && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${list.some(isLate) ? "bg-red-500" : "bg-emerald-500"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_24rem]" data-no-i18n>
      <section className="card overflow-hidden" aria-label="Kalender">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button type="button" aria-label={T.prev} onClick={() => step(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <h2 className="min-w-44 text-center text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" aria-label={T.next} onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
          <button type="button" onClick={() => setSelected(todayDay)} className="btn btn-sm ml-1">{T.today}</button>
          <div role="radiogroup" aria-label="Skala" className="ml-auto inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(["month", "week", "day", "year"] as Scale[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={scale === s} onClick={() => setScale(s)} className={`h-7 rounded-md px-3 text-xs font-medium transition ${scale === s ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{T.scale[s]}</button>
            ))}
          </div>
          <span className="w-full text-xs text-slate-500">{rangeCount} {countLabel}</span>
        </div>
        {scale === "month" && monthView}
        {scale === "week" && timeline(weekDays)}
        {scale === "day" && timeline([selected])}
        {scale === "year" && yearView}
      </section>

      <aside className="card overflow-hidden xl:sticky xl:top-20" aria-label={T.detail}>
        {mini}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{DAYS_LONG[L][selected.getDay()]}</div>
          <div className="text-lg font-semibold text-slate-900">{selected.getDate()} {MONTHS[L][selected.getMonth()]} {selected.getFullYear()}</div>
          <div className="text-xs text-slate-500">{dayList.length} {T.activities}</div>
        </div>
        {dayList.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">{T.none}</div>
        ) : (
          <ul className="max-h-[30rem] space-y-2 overflow-y-auto p-3">
            {dayList.map((a) => {
              const st = activityState(a);
              const late = st === "OVERDUE";
              return (
                <li key={a.id} className={`rounded-lg border p-3 text-sm ${late ? "border-red-300 bg-red-500/10" : "border-emerald-300 bg-emerald-500/10"}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${late ? "bg-red-500/15 text-red-600" : "bg-emerald-500/15 text-emerald-600"}`}><ActivityIcon name={a.icon} /></span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium ${st === "DONE" ? "text-slate-500 line-through" : ""}`}>{a.title}</div>
                      <div className="text-xs font-semibold text-slate-700">{hm(a.start)} – {hm(a.end)} <span className="font-normal text-slate-500">· {a.duration} {T.min}</span></div>
                    </div>
                    <Badge tone={ACTIVITY_STATE_TONE[st]}>{T.state[st]}</Badge>
                  </div>
                  <dl className="mt-2 space-y-0.5 pl-[2.625rem] text-xs text-slate-600">
                    <div><dt className="inline text-slate-400">{T.type}: </dt><dd className="inline">{a.type}</dd></div>
                    <div><dt className="inline text-slate-400">{T.lead}: </dt><dd className="inline"><Link href={`/leads/${a.lead_id}`} className="hover:underline">{a.lead}</Link> · {a.client}</dd></div>
                    <div><dt className="inline text-slate-400">{T.stage}: </dt><dd className="inline">{STAGE[L][a.stage] ?? a.stage}</dd></div>
                    {a.location && <div>📍 {a.location}</div>}
                    {a.sales.length > 0 && <div>👤 {a.sales.join(", ")}</div>}
                    {a.notes && <div className="whitespace-pre-wrap break-words pt-0.5">{a.notes}</div>}
                  </dl>
                  <div className="mt-2 pl-[2.625rem]">
                    <Link href={`/activities/${a.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"><ExternalLink size={12} /> {T.open}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
