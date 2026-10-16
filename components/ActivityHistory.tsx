"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import ActivityIcon from "./ActivityIcon";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { LEAD_LABEL, LEAD_STATUSES } from "@/lib/constants";
import { ACTIVITY_STATE_LABEL, ACTIVITY_STATE_TONE, activityState, fmtWhen } from "@/lib/when";
import type { LeadActivityDTO } from "./LeadActivities";

/**
 * Smart action "History Activity": activity dari tahap-tahap lead SEBELUMNYA. Saat lead pindah tahap, daftar Activity
 * dimulai baru dan yang lama masuk ke sini (hanya baca).
 */
export default function ActivityHistory({ items, compact = false }: { items: LeadActivityDTO[]; compact?: boolean }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  const order = LEAD_STATUSES as readonly string[];
  const groups = order.map((stage) => ({ stage, rows: items.filter((a) => a.stage === stage).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) })).filter((g) => g.rows.length > 0);
  const stages = groups.length;
  const undone = items.filter((a) => a.status !== "DONE").length;

  return (
    <>
      {compact ? (
        // Di header section Activity (paling kanan): tombol kecil dengan jumlah history
        <button type="button" onClick={() => setOpen(true)} className="btn btn-sm" title={items.length === 0 ? "Belum ada riwayat tahap sebelumnya" : `${stages} tahap sebelumnya${undone ? ` · ${undone} belum selesai` : ""}`}>
          <History size={14} /> History Activity
          <span className={`rounded-full px-1.5 text-[11px] font-semibold ${items.length ? "bg-violet-500/15 text-violet-600" : "bg-slate-200 text-slate-500"}`}>{items.length}</span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="card flex min-w-44 items-center gap-3 px-4 py-2.5 text-left transition hover:border-amber-400 hover:shadow-md">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${items.length ? "bg-violet-500/10 text-violet-600" : "bg-slate-100 text-slate-500"}`}><History size={20} /></span>
          <span className="min-w-0 leading-tight">
            <span className="block text-lg font-semibold text-slate-900">{items.length}</span>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">History Activity</span>
            <span className="block text-xs text-slate-400">{items.length === 0 ? "Belum ada riwayat tahap sebelumnya" : `${stages} tahap sebelumnya${undone ? ` · ${undone} belum selesai` : ""}`}</span>
          </span>
        </button>
      )}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label="History Activity" className="card w-full max-w-2xl p-0 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">History Activity</h2>
                  <p className="mt-1 text-sm text-slate-500">Activity dari tahap-tahap sebelumnya. Hanya untuk dilihat.</p>
                </div>
                <button type="button" aria-label="Tutup" onClick={() => setOpen(false)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {groups.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">Belum ada activity dari tahap sebelumnya. Activity tahap saat ini akan masuk ke sini setelah lead pindah tahap.</div>
                ) : (
                  groups.map((g) => (
                    <div key={g.stage} className="border-t border-slate-100 first:border-t-0">
                      <div className="flex items-center gap-2 bg-slate-50 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {LEAD_LABEL[g.stage]}
                        <span className="ml-auto font-normal text-slate-400">{g.rows.length}</span>
                      </div>
                      <ul className="space-y-2 p-3">
                        {g.rows.map((a) => {
                          const st = activityState(a);
                          const late = st !== "DONE"; // belum selesai saat lead sudah pindah (mis. ditutup Lost) → merah
                          return (
                            <li key={a.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${late ? "border-red-300 bg-red-500/10" : "border-emerald-300 bg-emerald-500/10"}`}>
                              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${late ? "bg-red-500/15 text-red-600" : "bg-emerald-500/15 text-emerald-600"}`}><ActivityIcon name={a.icon} /></span>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{a.title}</div>
                                <div className="text-xs text-slate-500"><span data-no-i18n>{a.type} · {fmtWhen(a.scheduled_at, lang)}</span> · {`${a.duration} menit`}</div>
                                {a.location && <div className="mt-0.5 text-xs text-slate-500" data-no-i18n>📍 {a.location}</div>}
                                {a.sales.length > 0 && <div className="mt-0.5 text-xs text-slate-500" data-no-i18n>👤 {a.sales.map((p) => p.name).join(", ")}</div>}
                                {a.notes && <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{a.notes}</div>}
                              </div>
                              <Badge tone={ACTIVITY_STATE_TONE[st]}>{ACTIVITY_STATE_LABEL[st]}</Badge>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Tutup</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
