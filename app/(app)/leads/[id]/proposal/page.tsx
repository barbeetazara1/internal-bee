import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import PdfFrame from "@/components/PdfFrame";
import ProposalDocument from "@/components/ProposalDocument";
import { resolveTemplate } from "@/lib/proposal-template";
import { ADDON_BILLING_LABEL, ADDON_PERIOD_UNIT } from "@/lib/addons";
import { LICENSE_LABEL, licenseTypeOf } from "@/lib/constants";

/** Cetak proposal untuk satu lead. Mode PDF → langsung membuka PDF template; mode Teks → dokumen berdesain dari template teks. */
export default async function LeadProposal({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const [lead, s] = await Promise.all([
    prisma.lead.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, addons: { include: { addon: true }, orderBy: { addon: { sort: "asc" } } }, owner: { select: { name: true } }, products: { include: { product: { select: { code: true, name: true } } }, orderBy: { product: { code: "asc" } } } } }),
    prisma.proposalSetting.findUnique({ where: { id: "default" } }),
  ]);
  if (!lead) notFound();
  const crumbs = <Breadcrumb items={[{ label: "Opportunities" }, { label: "Leads", href: "/leads" }, { label: lead.title, href: `/leads/${lead.id}` }, { label: "Proposal" }]} />;
  if (s?.mode === "PDF" && s.pdf_file) return <div>{crumbs}<PdfFrame src="/api/proposal/template" /></div>;
  const data = {
    number: `PRP-${lead.id.slice(0, 6).toUpperCase()}`,
    date: new Date(),
    lead: lead.title, client: lead.client.name, contact: lead.contact_name ?? "", email: lead.email ?? "", phone: lead.phone ?? "", owner: lead.owner.name,
    addons: lead.addons.map((a) => ({ name: a.addon.name, billing: ADDON_BILLING_LABEL[a.billing] ?? a.billing, periods: a.billing === "ONE_TIME" ? "" : `${a.periods} ${ADDON_PERIOD_UNIT[a.billing]}`, unit: Number(a.price) * a.quantity, subtotal: Number(a.price) * a.quantity * (a.billing === "ONE_TIME" ? 1 : a.periods), billed: !a.client_managed })),
    lines: lead.products.map((p) => ({ name: `${p.product.code} — ${p.product.name}`, license: LICENSE_LABEL[licenseTypeOf(p.license_months)] ?? "", price: Number(p.price) })),
  };
  return (
    <div>
      {crumbs}
      <div className="no-print mb-5 flex items-center gap-3">
        <PrintButton />
        {s?.mode === "PDF" && !s.pdf_file && <span className="text-sm text-slate-500">Mode PDF dipilih tetapi belum ada file PDF; memakai template teks. Unggah PDF di Settings → Proposal.</span>}
      </div>
      <ProposalDocument data={data} template={resolveTemplate(s)} />
    </div>
  );
}
