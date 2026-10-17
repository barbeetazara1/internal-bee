import Link from "next/link";
import { ChevronRight, Plus, type LucideIcon } from "lucide-react";
import { BILL_LABEL, LEAD_LABEL, TASK_LABEL } from "@/lib/constants";

const TONES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: "green", SUSPENDED: "amber", EXPIRED: "slate", REVOKED: "red",
  NEW: "slate", CONTACTED: "blue", QUALIFIED: "violet", PROPOSAL: "amber", NEGOTIATION: "amber", CLOSED_WON: "green", CLOSED_LOST: "red",
  TODO: "slate", IN_PROGRESS: "blue", IN_REVIEW: "violet", DONE: "green",
  ON_HOLD: "amber", COMPLETED: "green", SANDBOX: "violet", PRODUCTION: "green",
  UNPAID: "amber", OVERDUE: "red", PAID: "green", CANCELLED: "slate",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "slate"}>{LEAD_LABEL[status] ?? TASK_LABEL[status] ?? BILL_LABEL[status] ?? status.replace("_", " ")}</Badge>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Alert({ children, tone = "red" }: { children: React.ReactNode; tone?: "red" | "green" }) {
  const c = tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${c}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-xl font-bold tabular-nums text-slate-900 xl:text-2xl 2xl:text-3xl">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function CreateButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-primary">
      <Plus size={15} /> {children}
    </Link>
  );
}

export type Crumb = { label: string; href?: string };

/** Breadcrumb di kiri atas halaman record/form, mis. Product Catalog / PROD-OCR-01. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-3 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
          {c.href && i < items.length - 1 ? (
            <Link href={c.href} className="text-slate-500 hover:underline">{c.label}</Link>
          ) : (
            <span className="font-medium text-slate-800">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="card p-6">{children}</div>;
}

/** Tiga kartu ringkasan di atas list view. */
export function SummaryCards({ items }: { items: { label: string; value: React.ReactNode; hint?: string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((i) => (
        <Stat key={i.label} label={i.label} value={i.value} hint={i.hint} />
      ))}
    </div>
  );
}

/** Tombol pintas (smart button) di form record: angka ringkas + label yang menuju daftar record terkait. */
export function SmartButton({ href, icon: Icon, value, label, hint, tone = "slate" }: { href: string; icon: LucideIcon; value: React.ReactNode; label: string; hint?: string; tone?: "slate" | "red" | "green" | "amber" }) {
  const iconCls = tone === "red" ? "bg-red-50 text-red-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500";
  return (
    <Link href={href} className="card flex min-w-44 items-center gap-3 px-4 py-2.5 transition hover:border-amber-400 hover:shadow-md">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}><Icon size={20} /></span>
      <span className="min-w-0 leading-tight">
        <span className="block text-lg font-semibold text-slate-900">{value}</span>
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </Link>
  );
}
