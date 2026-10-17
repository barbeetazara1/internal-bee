"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, CalendarDays, Layers, Percent, type LucideIcon } from "lucide-react";
import Select from "./Select";
import NumericInput from "./NumericInput";
import DatePicker from "./DatePicker";
import { LICENSE_LABEL } from "@/lib/constants";
import { fmtDate, idr } from "@/lib/format";
import { BILL_KIND_LABEL, INTERVALS, todayStr, PAYMENT_KINDS_FOR, PAYMENT_KIND_LABEL, defaultPlan, paymentSchedule, planTotal, validatePlan, type PaymentKind, type PaymentPlan } from "@/lib/payment";

export type PayLine = { id: string; label: string; price: number; license_type: string };

const KIND_CARD: Record<PaymentKind, { desc: string; Icon: LucideIcon }> = {
  FULL: { desc: "Dibayar sekali, lunas di muka", Icon: Banknote },
  DP: { desc: "DP di awal, sisanya dicicil", Icon: Percent },
  INSTALLMENT: { desc: "Total dicicil sama rata", Icon: Layers },
  MONTHLY: { desc: "Ditagih setiap bulan", Icon: CalendarDays },
};

const INTERVAL_LABEL: Record<number, string> = { 1: "Setiap bulan", 2: "Setiap 2 bulan", 3: "Setiap 3 bulan", 6: "Setiap 6 bulan", 12: "Setiap tahun" };

/** Rencana baru saat user mengganti sistem pembayaran, dengan nilai awal yang masuk akal. */
function planOf(kind: PaymentKind, prev: PaymentPlan): PaymentPlan {
  const base = { first_due: prev.first_due };
  const n = "installments" in prev ? prev.installments : 2;
  const interval = "interval" in prev ? prev.interval : 1;
  if (kind === "FULL") return { kind, ...base };
  if (kind === "MONTHLY") return { kind, months: "months" in prev ? prev.months : 12, ...base };
  if (kind === "INSTALLMENT") return { kind, installments: Math.max(2, n), interval, ...base };
  return { kind, dp_percent: "dp_percent" in prev ? prev.dp_percent : 30, installments: n, interval, ...base };
}

/**
 * Modal sistem pembayaran per produk. Dibuka dari tombol `trigger`; Submit mengirim `id` dan `payment` (JSON rencana per baris)
 * ke server action `action`. Opsi yang tersedia mengikuti tipe lisensi baris: Tahunan bebas (bayar penuh / DP + cicilan / cicilan
 * sama rata), One-time (penuh / DP), Bulanan (per bulan sebanyak x bulan).
 */
export default function PaymentDialog({
  leadId, lines, action, trigger, triggerClassName, triggerDisabled, triggerTitle, title, intro, confirmLabel, open: controlledOpen, onClose,
}: {
  leadId: string; lines: PayLine[]; action: (fd: FormData) => void | Promise<void>;
  trigger?: string; triggerClassName?: string; triggerDisabled?: boolean; triggerTitle?: string; title: string; intro: string; confirmLabel: string;
  /** Mode terkendali: modal dibuka/ditutup oleh pemanggil (tanpa tombol pemicu). */
  open?: boolean; onClose?: () => void;
}) {
  const controlled = controlledOpen !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlled ? controlledOpen : innerOpen;
  const setOpen = (v: boolean) => (controlled ? !v && onClose?.() : setInnerOpen(v));
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Record<string, PaymentPlan>>(() => Object.fromEntries(lines.map((l) => [l.id, { ...defaultPlan(l.license_type), first_due: todayStr() }])));
  const start = new Date();
  const set = (id: string, p: PaymentPlan) => setPlans((x) => ({ ...x, [id]: p }));
  const errors = lines.map((l) => validatePlan(plans[l.id], l.license_type)).filter(Boolean);

  const num = (v: string) => (v === "" ? 0 : Number(v));
  // Label bisa membungkus jadi 2 baris di bahasa lain; kolom input dirapatkan ke bawah supaya tetap sejajar.
  const field = (label: string, children: React.ReactNode) => (<div className="flex flex-col justify-end"><label className="label">{label}</label>{children}</div>);

  const modal = open && (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
      <form
        action={action}
        onSubmit={() => setBusy(true)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-3xl p-0 shadow-2xl"
      >
        <input type="hidden" name="id" value={leadId} />
        <input type="hidden" name="payment" value={JSON.stringify(plans)} />
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{intro}</p>
        </div>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
          {lines.map((l) => {
            const p = plans[l.id];
            const kinds = PAYMENT_KINDS_FOR[l.license_type] ?? ["FULL"];
            const err = validatePlan(p, l.license_type);
            const rows = err ? [] : paymentSchedule(p, l.price, start);
            return (
              <div key={l.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium text-slate-900">{l.label}</div>
                  <div className="text-sm text-slate-500">
                    Lisensi {LICENSE_LABEL[l.license_type] ?? l.license_type} · {p.kind === "MONTHLY" ? "Harga per bulan " : "Total "}<b className="text-slate-900">{idr(l.price)}</b>
                  </div>
                </div>
                <div role="radiogroup" aria-label="Sistem pembayaran" className={`grid grid-cols-1 items-stretch gap-3 ${kinds.length === 1 ? "md:grid-cols-1" : kinds.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  {kinds.map((k) => {
                    const { desc, Icon } = KIND_CARD[k];
                    return (
                      <label key={k} className="relative block h-full cursor-pointer">
                        <input type="radio" name={`kind-${l.id}`} checked={p.kind === k} onChange={() => set(l.id, planOf(k, p))} className="peer sr-only" />
                        <span className="flex h-full items-start gap-3 rounded-xl border-2 border-slate-200 bg-surface p-3 transition hover:border-slate-300 peer-checked:border-amber-400 peer-checked:bg-amber-400/15 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon size={18} /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">{PAYMENT_KIND_LABEL[k]}</span>
                            <span className="block text-xs text-slate-500">{desc}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
                  {field(p.kind === "FULL" ? "Tanggal pembayaran" : "Pembayaran pertama", (
                    <DatePicker required min={todayStr()} value={p.first_due ?? ""} onChange={(v) => set(l.id, { ...p, first_due: v })} />
                  ))}
                  {p.kind === "MONTHLY" && field("Jumlah bulan (x)", <NumericInput maxDigits={2} value={String(p.months)} onChange={(v) => set(l.id, { ...p, months: num(v) })} />)}
                  {p.kind === "DP" && field("DP (%)", <NumericInput maxDigits={2} value={String(p.dp_percent)} onChange={(v) => set(l.id, { ...p, dp_percent: num(v) })} />)}
                  {(p.kind === "DP" || p.kind === "INSTALLMENT") && field(p.kind === "DP" ? "Cicilan sisa (x)" : "Jumlah cicilan (x)", <NumericInput maxDigits={2} value={String(p.installments)} onChange={(v) => set(l.id, { ...p, installments: num(v) })} />)}
                  {(p.kind === "DP" || p.kind === "INSTALLMENT") && field("Jarak cicilan", (
                    <Select key={`${l.id}-i`} options={INTERVALS.map((i) => ({ value: String(i), label: INTERVAL_LABEL[i] }))} defaultValue={String(p.interval)} onChange={(v) => set(l.id, { ...p, interval: Number(v) })} />
                  ))}
                </div>
                {err ? (
                  <p className="mt-3 text-sm text-red-600">{err}</p>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1">#</th><th>Jenis</th><th>Jatuh Tempo</th><th className="text-right">Jumlah</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 12).map((r) => (
                        <tr key={r.no}><td className="py-1">{r.no}</td><td>{BILL_KIND_LABEL[r.kind]}</td><td>{fmtDate(r.due)}</td><td className="text-right">{idr(r.amount)}</td></tr>
                      ))}
                      {rows.length > 12 && <tr><td colSpan={4} className="py-1 text-xs text-slate-400">… dan {rows.length - 12} bill lainnya</td></tr>}
                    </tbody>
                    <tfoot><tr className="font-medium"><td colSpan={3} className="pt-2">Total ({rows.length} bill)</td><td className="pt-2 text-right">{idr(planTotal(p, l.price))}</td></tr></tfoot>
                  </table>
                )}
                {!err && rows.length > 1 && <p className="mt-2 text-xs text-slate-400">Hanya bill pertama yang dibuat sekarang; bill berikutnya dibuat satu per satu setelah bill sebelumnya dibayar.</p>}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy || errors.length > 0}>{busy ? "Memproses…" : confirmLabel}</button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {!controlled && <button type="button" className={triggerClassName} disabled={triggerDisabled} title={triggerTitle} onClick={() => setOpen(true)}>{trigger}</button>}
      {modal && createPortal(modal, document.body)}
    </>
  );
}
