import Link from "next/link";
import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import ActionBar from "@/components/ActionBar";
import ActionsMenu from "@/components/ActionsMenu";
import PaidDialog from "@/components/PaidDialog";
import ChatterSection from "@/components/ChatterSection";
import ConfirmButton from "@/components/ConfirmButton";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import MoneyInput from "@/components/MoneyInput";
import DatePicker from "@/components/DatePicker";
import Section from "@/components/Section";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, fmtDateTime, idr, toInputDate } from "@/lib/format";
import { changeBillStatus, saveBill } from "@/app/actions/bills";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function BillDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> }) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const { project: fromProject } = await searchParams;
  const b = await prisma.bill.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, lead: true, project: true, product: true, api_key: true } });
  if (!b) notFound();
  const canEdit = can.manageBills(user.role);
  const st = effectiveBillStatus(b);

  // Status bar: Belum Dibayar (→ Jatuh Tempo bila lewat) → Lunas, atau Belum Dibayar → Dibatalkan
  const flow = b.status === "CANCELLED" ? ["UNPAID", "CANCELLED"] : ["UNPAID", "PAID"];
  const cur = b.status === "UNPAID" ? "UNPAID" : b.status;
  const idx = flow.indexOf(cur);
  const steps: Step[] = flow.map((s, i) => {
    const current = i === idx;
    const status = current && s === "UNPAID" && st === "OVERDUE" ? "OVERDUE" : s;
    const date = s === "UNPAID" ? fmtDate(b.created_at) : s === "PAID" && b.paid_at ? fmtDate(b.paid_at) : null;
    return { status, label: BILL_LABEL[status], state: current ? "current" : i < idx ? "done" : "todo", date: i <= idx ? date : null };
  });

  const act = (status: string, label: string, cls = "btn") => (
    <form action={changeBillStatus}>
      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={status} />
      <button className={cls}>{label}</button>
    </form>
  );
  const invoiceHref = `/bills/${b.id}/invoice${fromProject && b.project?.id === fromProject ? `?project=${fromProject}` : ""}`;
  const menu = <ActionsMenu items={[{ label: "Generate Invoice", href: invoiceHref, icon: "document" }]} />;
  const buttons = canEdit && (
    <>
      {b.status === "UNPAID" && <PaidDialog billId={b.id} code={b.code} amount={idr(Number(b.amount))} />}
      {b.status === "UNPAID" && (
        <form action={changeBillStatus}>
          <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="CANCELLED" />
          <ConfirmButton danger title="Batalkan bill?" confirmLabel="Ya, Batalkan" message="Bill ini ditandai dibatalkan dan tidak lagi dihitung sebagai tagihan. Anda bisa membukanya kembali." className="btn btn-danger">Batalkan Bill</ConfirmButton>
        </form>
      )}
      {b.status !== "UNPAID" && act("UNPAID", "Buka Kembali")}
    </>
  );

  return (
    <RecordProvider listHref={fromProject && b.project?.id === fromProject ? `/bills?project=${fromProject}` : "/bills"}>
      <div>
        <Breadcrumb
          items={
            // Datang dari smart button project: Projects / <project> / Bills / <bill>
            fromProject && b.project && b.project.id === fromProject
              ? [{ label: "Projects", href: "/projects" }, { label: b.project.name, href: `/projects/${b.project.id}` }, { label: "Bills", href: `/bills?project=${b.project.id}` }, { label: b.code }]
              : [{ label: "Bills", href: "/bills" }, { label: b.code }]
          }
        />
        <PageHeader title={b.code} subtitle={`${b.client.name} — ${b.addon_name ? `Add-on: ${b.addon_name}` : b.product.name}`} />
        {canEdit && b.status === "UNPAID" ? (
          <RecordBar extra={buttons} center={menu} right={<LeadStatusProgress steps={steps} />} />
        ) : (
          <ActionBar right={<LeadStatusProgress steps={steps} />}>{buttons}{menu}</ActionBar>
        )}

        <div className="space-y-6">
          <Section title="Informasi Bill" subtitle="Asal tagihan dan jenis pembayarannya">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Client"><Link href={`/clients/${b.client_id}`} className="font-medium hover:underline">{b.client.name}</Link></Field>
              <Field label="Lead"><Link href={`/leads/${b.lead_id}`} className="hover:underline">{b.lead.title}</Link></Field>
              <Field label="Project">{b.project ? <Link href={`/projects/${b.project.id}`} className="hover:underline">{b.project.name}</Link> : "—"}</Field>
              <Field label="License">{b.api_key ? <Link href={`/licenses/${b.api_key.id}`} className="font-mono text-xs hover:underline">{b.api_key.prefix}••••{b.api_key.key_hint}</Link> : "—"}</Field>
              <Field label={b.addon_name ? "Add-on" : "Produk"}>{b.addon_name ? <>{b.addon_name} · </> : null}{b.product.name} <span className="font-mono text-xs text-slate-500">{b.product.code}</span></Field>
              <Field label="Jenis Pembayaran">{BILL_KIND_LABEL[b.kind] ?? b.kind}</Field>
              <Field label="Periode">{b.period_no} dari {b.period_total}{b.period_start ? ` · ${fmtDate(b.period_start)}${b.period_end ? ` – ${fmtDate(b.period_end)}` : ""}` : ""}</Field>
              <Field label="Status"><StatusBadge status={st} /></Field>
              {b.service_id && <Field label="Layanan"><Link href={`/services/${b.service_id}`} className="hover:underline">Lihat masa aktif layanan</Link></Field>}
            </div>
          </Section>
        </div>

        <RecordForm action={saveBill} locked={b.status !== "UNPAID" || !canEdit} className="fields-compact mt-6 space-y-6">
          <input type="hidden" name="id" value={b.id} />
          <Section title="Pembayaran" subtitle="Jumlah, jatuh tempo, dan catatan tagihan">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
              <div><label className="label">Jumlah<span className="text-red-500"> *</span></label><MoneyInput name="amount" defaultValue={Number(b.amount)} /></div>
              <div><label className="label">Jatuh Tempo<span className="text-red-500"> *</span></label><DatePicker name="due_date" required defaultValue={toInputDate(b.due_date)} /></div>
              <div><label className="label">Dibayar pada</label><div className="input flex items-center bg-slate-50 text-slate-500" data-locked-field>{b.paid_at ? fmtDateTime(b.paid_at) : "—"}</div></div>
              <div className="md:col-span-3"><label className="label">Catatan</label><textarea name="notes" rows={2} defaultValue={b.notes ?? ""} className="input" /></div>
            </div>
          </Section>
        </RecordForm>

        {b.proof_file && (
          <Section className="mt-6" title="Bukti Pembayaran" subtitle="File yang dilampirkan saat bill ditandai lunas">
            <div className="flex flex-wrap items-center gap-4">
              {b.proof_type?.startsWith("image/") ? (
                <a href={`/api/bills/${b.id}/proof`} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/bills/${b.id}/proof`} alt="Bukti pembayaran" className="h-28 w-28 rounded-lg border border-slate-200 object-cover" />
                </a>
              ) : (
                <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500"><FileText size={36} /></span>
              )}
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium">{b.proof_name}</div>
                <div className="text-xs text-slate-500">{b.proof_type === "application/pdf" ? "PDF" : b.proof_type === "image/png" ? "PNG" : "JPG"} · {b.proof_size ? (b.proof_size >= 1048576 ? `${(b.proof_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b.proof_size / 1024))} KB`) : ""}{b.paid_at ? ` · dibayar ${fmtDate(b.paid_at)}` : ""}</div>
                <div className="mt-2 flex gap-2">
                  <a href={`/api/bills/${b.id}/proof`} target="_blank" rel="noreferrer" className="btn btn-sm">Lihat</a>
                  <a href={`/api/bills/${b.id}/proof?download=1`} className="btn btn-sm">Unduh</a>
                </div>
              </div>
            </div>
          </Section>
        )}

        <ChatterSection type="bill" id={b.id} label={b.code} />
      </div>
    </RecordProvider>
  );
}
