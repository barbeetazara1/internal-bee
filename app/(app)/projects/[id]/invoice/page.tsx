import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, idr, jktDayStart } from "@/lib/format";

/** Invoice gabungan: semua tagihan project yang jatuh tempo di hari yang sama (?due=YYYY-MM-DD), dicetak / disimpan sebagai PDF. */
export default async function ProjectInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ due?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const { due } = await searchParams;
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) notFound();
  const day = jktDayStart(due);
  if (Number.isNaN(day.getTime())) notFound();
  const project = await prisma.project.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, lead: { include: { owner: { select: { name: true } } } } } });
  if (!project) notFound();
  const bills = await prisma.bill.findMany({
    relationLoadStrategy: "join",
    where: { project_id: id, status: { not: "CANCELLED" }, due_date: { gte: day, lt: new Date(day.getTime() + 86400000) } },
    include: { product: { select: { code: true, name: true } } },
    orderBy: [{ addon_name: "asc" }, { product_id: "asc" }, { period_no: "asc" }],
  });
  if (bills.length === 0) notFound();

  const total = bills.reduce((a, b) => a + Number(b.amount), 0);
  const paid = bills.filter((b) => b.status === "PAID").reduce((a, b) => a + Number(b.amount), 0);
  const remaining = total - paid;
  const allPaid = remaining === 0;
  const docNo = `INV-${due.replace(/-/g, "").slice(2)}-${id.slice(0, 4).toUpperCase()}`;
  const lead = project.lead;

  return (
    <div>
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${id}` }, { label: "Invoice Gabungan" }]} />
      <div className="no-print mb-5"><PrintButton /></div>
      <div className="relative mx-auto max-w-3xl rounded-xl border border-slate-200 bg-surface p-10 shadow-sm print:border-0 print:shadow-none">
        {allPaid && <div className="pointer-events-none absolute right-10 top-28 rotate-[-12deg] rounded-md border-4 border-emerald-500 px-4 py-1 text-3xl font-bold tracking-widest text-emerald-500 opacity-70">LUNAS</div>}
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
            <div className="font-semibold">{project.client.name}</div>
            {lead?.contact_name && <div>{lead.contact_name}</div>}
            <div className="text-slate-500">{[lead?.email, lead?.phone].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-slate-500">Project</div>
            <div className="font-semibold">{project.name}</div>
            <div className="mt-1 text-xs font-semibold uppercase text-slate-500">Jatuh Tempo</div>
            <div className="font-semibold">{fmtDate(day)}</div>
          </div>
        </div>
        <table className="mb-6 w-full text-sm">
          <thead><tr className="border-b-2 border-slate-800 text-left"><th className="w-8 py-2">No</th><th className="py-2">Deskripsi</th><th className="py-2">Pembayaran</th><th className="py-2 text-right">Jumlah</th></tr></thead>
          <tbody>
            {bills.map((b, i) => {
              const st = effectiveBillStatus(b);
              return (
                <tr key={b.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  <td className="py-2">
                    <div className="font-medium">{b.addon_name ? `Add-on: ${b.addon_name}` : b.product.name}</div>
                    <div className="text-xs text-slate-500">{b.addon_name ? b.product.name : b.product.code} · {b.code}</div>
                  </td>
                  <td className="py-2">
                    {BILL_KIND_LABEL[b.kind] ?? b.kind} · {b.period_no} dari {b.period_total}
                    {b.period_start && <div className="text-xs text-slate-500">{fmtDate(b.period_start)}{b.period_end ? ` – ${fmtDate(b.period_end)}` : ""}</div>}
                    {b.status === "PAID" && <div className="text-xs text-emerald-600">{BILL_LABEL[st]}{b.paid_at ? ` · ${fmtDate(b.paid_at)}` : ""}</div>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{idr(Number(b.amount))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex justify-end">
          <div className="w-72 text-sm">
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Total tagihan</span><span className="tabular-nums">{idr(total)}</span></div>
            {paid > 0 && <div className="flex justify-between py-0.5"><span className="text-slate-500">Sudah dibayar</span><span className="tabular-nums">− {idr(paid)}</span></div>}
            <div className="mt-1 flex justify-between border-t-2 border-slate-800 pt-2 text-base font-semibold"><span>{allPaid ? "Total" : "Sisa yang harus dibayar"}</span><span className="tabular-nums">{idr(allPaid ? total : remaining)}</span></div>
          </div>
        </div>
        <div className="mt-10 text-xs text-slate-500">Disiapkan oleh {lead?.owner.name ?? "Internal Bee"}. Harga belum termasuk pajak. Dokumen ini dibuat otomatis oleh Internal Bee.</div>
      </div>
    </div>
  );
}
