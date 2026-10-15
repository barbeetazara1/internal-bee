import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, idr } from "@/lib/format";

/** Invoice untuk satu bill (dicetak / disimpan sebagai PDF). */
export default async function BillInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const { project: fromProject } = await searchParams;
  const b = await prisma.bill.findUnique({ where: { id }, include: { client: true, lead: { include: { owner: true } }, product: true, project: true } });
  if (!b) notFound();
  const st = effectiveBillStatus(b);
  const docNo = `INV-${b.code.replace("BILL-", "")}`;
  const ctx = fromProject && b.project?.id === fromProject ? `?project=${fromProject}` : "";
  const crumbs = ctx && b.project
    ? [{ label: "Projects", href: "/projects" }, { label: b.project.name, href: `/projects/${b.project.id}` }, { label: "Bills", href: `/bills?project=${b.project.id}` }]
    : [{ label: "Bills", href: "/bills" }];

  return (
    <div>
      <Breadcrumb items={[...crumbs, { label: b.code, href: `/bills/${b.id}${ctx}` }, { label: "Invoice" }]} />
      <div className="no-print mb-5"><PrintButton /></div>
      <div className="relative mx-auto max-w-3xl rounded-xl border border-slate-200 bg-surface p-10 shadow-sm print:border-0 print:shadow-none">
        {b.status === "PAID" && <div className="pointer-events-none absolute right-10 top-28 rotate-[-12deg] rounded-md border-4 border-emerald-500 px-4 py-1 text-3xl font-bold tracking-widest text-emerald-500 opacity-70">LUNAS</div>}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold"><span>🐝</span> Internal Bee</div>
            <div className="text-sm text-slate-500">Software & API Licensing</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-wide">INVOICE</div>
            <div className="text-sm text-slate-500">{docNo}</div>
            <div className="text-sm text-slate-500">{fmtDate(new Date())}</div>
          </div>
        </div>
        <div className="mb-8 flex justify-between text-sm">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Kepada</div>
            <div className="font-semibold">{b.client.name}</div>
            <div>{b.lead.contact_name}</div>
            <div className="text-slate-500">{b.lead.email} {b.lead.phone && `· ${b.lead.phone}`}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-slate-500">Jatuh Tempo</div>
            <div className="font-semibold">{fmtDate(b.due_date)}</div>
            <div className="mt-1 text-xs font-semibold uppercase text-slate-500">Status</div>
            <div>{BILL_LABEL[st]}{b.paid_at ? ` · ${fmtDate(b.paid_at)}` : ""}</div>
          </div>
        </div>
        <table className="mb-6 w-full text-sm">
          <thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-2">Produk</th><th className="py-2">Pembayaran</th><th className="py-2 text-right">Jumlah</th></tr></thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2"><div className="font-medium">{b.product.name}</div><div className="text-xs text-slate-500">{b.product.code}</div></td>
              <td className="py-2">
                {BILL_KIND_LABEL[b.kind] ?? b.kind} · {b.period_no} dari {b.period_total}
                {b.period_start && <div className="text-xs text-slate-500">{fmtDate(b.period_start)}{b.period_end ? ` – ${fmtDate(b.period_end)}` : ""}</div>}
              </td>
              <td className="py-2 text-right">{idr(Number(b.amount))}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-base font-semibold"><span>Total</span><span>{idr(Number(b.amount))}</span></div>
          </div>
        </div>
        {b.notes && <div className="mt-6 text-sm"><div className="text-xs font-semibold uppercase text-slate-500">Catatan</div>{b.notes}</div>}
        <div className="mt-10 text-xs text-slate-500">Disiapkan oleh {b.lead.owner.name}. Harga belum termasuk pajak. Dokumen ini dibuat otomatis oleh Internal Bee.</div>
      </div>
    </div>
  );
}
