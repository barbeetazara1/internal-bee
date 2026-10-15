"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Ban, Receipt, CheckCircle2, ChevronDown, ClipboardList, Eye, FileText, Handshake, Hourglass, ListTodo, Loader, PauseCircle, PhoneCall, Play, ShieldCheck, Sparkles, Trophy, UserCheck, XCircle, type LucideIcon } from "lucide-react";

export type Step = { status: string; label: string; state: "done" | "current" | "todo"; date?: string | null };

const ICON: Record<string, LucideIcon> = {
  NEW: Sparkles,
  CONTACTED: PhoneCall,
  QUALIFIED: UserCheck,
  PROPOSAL: FileText,
  NEGOTIATION: Handshake,
  CLOSED_WON: Trophy,
  CLOSED_LOST: XCircle,
  // Demo
  REQUESTED: ClipboardList,
  ACTIVE: Play,
  ENDED: CheckCircle2,
  CANCELLED: XCircle,
  // Project
  ON_HOLD: PauseCircle,
  COMPLETED: CheckCircle2,
  // Task
  TODO: ListTodo,
  IN_PROGRESS: Loader,
  IN_REVIEW: Eye,
  DONE: CheckCircle2,
  // Bill
  UNPAID: Receipt,
  OVERDUE: AlertTriangle,
  PAID: CheckCircle2,
  // License
  L_ACTIVE: ShieldCheck,
  SUSPENDED: PauseCircle,
  EXPIRED: Hourglass,
  REVOKED: Ban,
};

/** Warna lingkaran ikon menurut keadaan langkah (selesai / saat ini / berikutnya). */
const circle = (s: Step) => {
  if (s.state === "done") return "bg-emerald-500 text-white";
  if (s.state === "current") return s.status === "CLOSED_LOST" || s.status === "CANCELLED" || s.status === "REVOKED" || s.status === "OVERDUE" ? "bg-red-500 text-white" : s.status === "CLOSED_WON" || s.status === "COMPLETED" || s.status === "DONE" || s.status === "PAID" ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-900";
  return "border-2 border-slate-300 bg-surface text-slate-400";
};

/** Status record + dropdown progres tahap (dipakai Lead dan Demo). Langkah yang tidak pernah dicapai (setelah Closed Lost / Dibatalkan) tidak ditampilkan. */
export default function LeadStatusProgress({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = steps.find((s) => s.state === "current") ?? steps[0];
  const CurIcon = ICON[current.status] ?? Sparkles;

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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Lihat progres status"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface py-2 pl-2.5 pr-3 shadow-sm transition hover:bg-slate-50"
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${circle(current)}`}>
          <CurIcon size={19} />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-xs uppercase tracking-wide text-slate-400">Status</span>
          <span className="block text-base font-semibold text-slate-900">{current.label}</span>
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="listbox" aria-label="Progres status" className="absolute right-0 z-40 mt-2 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-xl">
          <ol className="p-5">
            {steps.map((s, i) => {
              const Icon = ICON[s.status] ?? Sparkles;
              const last = i === steps.length - 1;
              return (
                <li key={s.status} role="option" aria-selected={s.state === "current"} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className={`absolute left-5 top-11 h-[calc(100%-2.75rem)] w-0.5 -translate-x-1/2 ${s.state === "done" ? "bg-emerald-300" : "bg-slate-200"}`} />}
                  <span className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${circle(s)}`}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1 self-center">
                    <div className={`text-base leading-tight ${s.state === "current" ? "font-semibold text-slate-900" : s.state === "done" ? "font-medium text-slate-700" : "text-slate-400"}`}>
                      {s.label}
                      {s.state === "current" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">saat ini</span>}
                    </div>
                    {s.date && <div className="mt-0.5 text-sm text-slate-400">{s.date}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
