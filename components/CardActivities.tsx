"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ListChecks, RotateCcw } from "lucide-react";
import ActivityIcon from "./ActivityIcon";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { toast } from "./toast";
import { ACTIVITY_STATE_LABEL, ACTIVITY_STATE_TONE, activityState, fmtWhen } from "@/lib/when";
import { setLeadActivityDone } from "@/app/actions/lead-activities";

export type CardActivity = { id: string; title: string; duration: number; type: string; icon: string; scheduled_at: string; status: string };

/** Dropdown activity pada kartu Kanban lead: activity di tahap saat ini (terjadwal dulu), bisa ditandai selesai langsung dari kartu. */
export default function CardActivities({ leadId, items }: { leadId: string; items: CardActivity[] }) {
  const router = useRouter();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, up: false });
  const [, start] = useTransition();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const rows = [...items].sort((a, b) => (a.status === b.status ? new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime() : a.status === "DONE" ? 1 : -1));
  const planned = rows.filter((a) => a.status !== "DONE");
  const overdue = planned.filter((a) => activityState(a) === "OVERDUE").length;

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const scroll = (e: Event) => !pop.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", () => setOpen(false));
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); // tombol berada di dalam kartu (tautan): jangan membuka lead
    e.stopPropagation();
    if (open) return setOpen(false);
    const r = btn.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom;
    setPos({ top: up ? r.top : r.bottom, left: Math.max(8, Math.min(r.left, window.innerWidth - 328)), up });
    setOpen(true);
  }

  function done(e: React.MouseEvent, a: CardActivity) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await setLeadActivityDone(a.id, a.status !== "DONE");
      toast(r.message, !r.ok ? "error" : "success");
      router.refresh();
    });
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        draggable={false}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={`mt-2 flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${overdue > 0 ? "border-red-200 bg-red-50 text-red-700" : planned.length > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
      >
        <ListChecks size={13} className="shrink-0" />
        <span className="font-medium">Activity</span>
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-semibold">{planned.length}</span>
        {overdue > 0 && <span className="text-[10px] font-semibold">{`${overdue} terlambat`}</span>}
        <ChevronDown size={13} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Activity"
            data-no-i18n
            style={{ position: "fixed", left: pos.left, width: 320, ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }) }}
            className="z-[90] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xl"
          >
            <div className="max-h-72 overflow-y-auto">
              {rows.length === 0 && <div className="px-4 py-5 text-center text-sm text-slate-400">Belum ada activity di tahap ini</div>}
              {rows.map((a) => {
                const st = activityState(a);
                return (
                  <div key={a.id} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ActivityIcon name={a.icon} size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-medium ${st === "DONE" ? "text-slate-400 line-through" : ""}`}>{a.title}</div>
                      <div className="truncate text-xs text-slate-500">{a.type} · {fmtWhen(a.scheduled_at, lang)} · {`${a.duration} menit`}</div>
                    </div>
                    <Badge tone={ACTIVITY_STATE_TONE[st]}>{ACTIVITY_STATE_LABEL[st]}</Badge>
                    <button type="button" title={st === "DONE" ? "Kembalikan ke terjadwal" : "Tandai selesai"} aria-label={st === "DONE" ? "Kembalikan ke terjadwal" : "Tandai selesai"} onClick={(e) => done(e, a)} className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                      {st === "DONE" ? <RotateCcw size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
            <Link href={`/leads/${leadId}`} className="block border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-xs font-medium text-amber-700 hover:bg-amber-50">Buka lead untuk menambah activity →</Link>
          </div>,
          document.body,
        )}
    </>
  );
}
