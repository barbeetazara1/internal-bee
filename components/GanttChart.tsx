"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskDTO, UserDTO } from "./task-types";

const DAY = 28; // px per hari
const ROW = 40;
const LABEL_W = 240;
const BAR: Record<string, string> = { TODO: "bg-slate-400", IN_PROGRESS: "bg-sky-500", IN_REVIEW: "bg-violet-500", DONE: "bg-emerald-500" };
const MS = 86400000;
const t0 = (s: string) => Date.parse(s + "T00:00:00Z");

export default function GanttChart({ projectId, tasks }: { projectId: string; tasks: TaskDTO[]; users?: UserDTO[]; editable?: boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const { min, days, rows } = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (!sorted.length) return { min: 0, days: 0, rows: [] as TaskDTO[] };
    const min = Math.min(...sorted.map((t) => t0(t.start_date))) - 2 * MS;
    const max = Math.max(...sorted.map((t) => t0(t.due_date))) + 3 * MS;
    return { min, days: Math.round((max - min) / MS) + 1, rows: sorted };
  }, [tasks]);

  if (!rows.length) return <div className="card p-10 text-center text-sm text-slate-400">Belum ada task.</div>;

  const x = (iso: string) => Math.round((t0(iso) - min) / MS) * DAY;
  const w = (t: TaskDTO) => (Math.round((t0(t.due_date) - t0(t.start_date)) / MS) + 1) * DAY;
  const idx = Object.fromEntries(rows.map((t, i) => [t.id, i]));
  const todayX = Math.round((Date.now() - min) / MS) * DAY;
  const dayList = Array.from({ length: days }, (_, i) => new Date(min + i * MS));
  const width = days * DAY;

  return (
    <div>
      <div className="card overflow-auto">
        <div style={{ width: LABEL_W + width }} className="relative">
          {/* header */}
          <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <div style={{ width: LABEL_W }} className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold">Task</div>
            <div className="relative flex" style={{ width }}>
              {dayList.map((d, i) => (
                <div key={i} style={{ width: DAY }} className={`shrink-0 border-l border-slate-100 py-1 text-center ${[0, 6].includes(d.getUTCDay()) ? "bg-slate-100" : ""}`}>
                  <div className="text-[11px] leading-none text-slate-400">{d.getUTCDate() === 1 || i === 0 ? d.toLocaleString("id-ID", { month: "short", timeZone: "UTC" }) : " "}</div>
                  <div className="mt-1 leading-none">{d.getUTCDate()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* body */}
          <div className="relative">
            {rows.map((t, i) => (
              <div key={t.id} className={`flex border-b border-slate-100 ${hover === t.id ? "bg-slate-50" : ""}`} style={{ height: ROW }}>
                <button
                  onClick={() => router.push(`/projects/${projectId}/tasks/${t.id}`)}
                  style={{ width: LABEL_W }}
                  className="sticky left-0 z-10 shrink-0 truncate border-r border-slate-200 bg-inherit bg-surface px-3 text-left text-sm hover:text-amber-600"
                  title={t.title}
                >
                  {t.title}
                </button>
                <div className="relative" style={{ width }}>
                  {dayList.map((d, k) => ([0, 6].includes(d.getUTCDay()) ? <div key={k} className="absolute inset-y-0 bg-slate-50" style={{ left: k * DAY, width: DAY }} /> : null))}
                </div>
              </div>
            ))}

            {/* overlay: bars + dependency arrows */}
            <div className="pointer-events-none absolute top-0" style={{ left: LABEL_W, width, height: rows.length * ROW }}>
              <svg className="absolute inset-0" width={width} height={rows.length * ROW}>
                <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="#94a3b8" /></marker></defs>
                {rows.map((t, i) => {
                  if (!t.depends_on_id || idx[t.depends_on_id] === undefined) return null;
                  const p = rows[idx[t.depends_on_id]];
                  const x1 = x(p.start_date) + w(p), y1 = idx[p.id] * ROW + ROW / 2;
                  const x2 = x(t.start_date), y2 = i * ROW + ROW / 2;
                  const mid = Math.max(x1 + 8, Math.min(x2 - 8, (x1 + x2) / 2));
                  const hot = hover === t.id || hover === p.id;
                  return <path key={t.id} d={`M${x1} ${y1} H${mid} V${y2} H${x2 - 2}`} fill="none" stroke={hot ? "#f59e0b" : "#cbd5e1"} strokeWidth={hot ? 2 : 1.5} markerEnd="url(#arr)" />;
                })}
                {todayX >= 0 && todayX <= width && <line x1={todayX + DAY / 2} x2={todayX + DAY / 2} y1={0} y2={rows.length * ROW} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} />}
              </svg>
              {rows.map((t, i) => (
                <div
                  key={t.id}
                  onMouseEnter={() => setHover(t.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => router.push(`/projects/${projectId}/tasks/${t.id}`)}
                  title={`${t.title}\n${t.start_date} → ${t.due_date}`}
                  className={`pointer-events-auto absolute flex cursor-pointer items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm ring-offset-1 transition ${BAR[t.status]} ${t.status === "DONE" ? "opacity-60" : ""}`}
                  style={{ left: x(t.start_date), width: w(t) - 2, top: i * ROW + 8, height: ROW - 16 }}
                >
                  <span className="truncate">{w(t) > 90 ? t.title : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        {Object.entries(BAR).map(([s, c]) => <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded ${c}`} />{s.replace("_", " ")}</span>)}
        <span className="flex items-center gap-1.5"><span className="h-3 w-px border-l-2 border-dashed border-red-500" />Hari ini</span>
        <span>Panah = keterkaitan task (dependency). Klik bar untuk membuka form task.</span>
      </div>
    </div>
  );
}
