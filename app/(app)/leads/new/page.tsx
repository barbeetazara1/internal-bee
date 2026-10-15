import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import ClientPicker from "@/components/ClientPicker";
import PhoneInput from "@/components/PhoneInput";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import LeadLines from "@/components/LeadLines";
import LeadStatusProgress from "@/components/LeadStatusProgress";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { Alert, PageHeader , Breadcrumb } from "@/components/ui";
import { createLead } from "@/app/actions/leads";

export default async function NewLead({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const sp = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const products = await prisma.product.findMany({ where: { is_active: true }, orderBy: { code: "asc" } });
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}`, price: Number(p.base_price), license_type: p.license_type }));
  // Status awal lead baru: tahap "Baru"; tahap lain belum tercapai.
  const steps = [
    { status: "NEW", label: "Baru", state: "current" as const },
    { status: "CONTACTED", label: "Dihubungi", state: "todo" as const },
    { status: "QUALIFIED", label: "Qualified", state: "todo" as const },
    { status: "PROPOSAL", label: "Proposal", state: "todo" as const },
    { status: "NEGOTIATION", label: "Negosiasi", state: "todo" as const },
    { status: "CLOSED_WON", label: "Closed Won", state: "todo" as const },
  ];
  return (
    <RecordProvider isNew listHref="/leads">
    <div>
      <Breadcrumb items={[{ label: "Leads (CRM)", href: "/leads" }, { label: "Lead Baru" }]} />
      <PageHeader title="Lead Baru" subtitle="Isi detail lead dan produk yang diminati, lalu Save" />
      <RecordBar right={<LeadStatusProgress steps={steps} />} />
      {sp.error && <Alert>{sp.error}</Alert>}
      <RecordForm action={createLead} className="fields-compact">
        <Section title="Detail Lead" subtitle="Informasi peluang dan kontak">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {/* Kolom kiri, atas ke bawah */}
          <div className="space-y-2">
            <div><label className="label">Judul peluang</label><input name="title" className="input" placeholder="(opsional — otomatis dari nama client)" /></div>
            <div><label className="label">Client<span className="text-red-500"> *</span> <Link href="/clients/new" className="ml-1 font-normal text-amber-600 hover:underline">+ Client Baru</Link></label><ClientPicker options={clients.map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }))} /></div>
            <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required className="input" /></div>
            <div><label className="label">Email</label><input name="email" type="email" className="input" /></div>
          </div>
          {/* Kolom kanan, atas ke bawah */}
          <div className="space-y-2">
            <div><label className="label">Telepon<span className="text-red-500"> *</span></label><PhoneInput name="phone" required className="input" /></div>
            <div><label className="label">Sumber</label><input name="source" className="input" placeholder="Referral, Website, …" /></div>
          </div>
          {/* Paling bawah, selebar kartu */}
          <div className="md:col-span-2"><label className="label">Catatan</label><textarea name="notes" rows={2} className="input" /></div>
        </div>
        </Section>
      </RecordForm>

      <div className="mt-6">
        <LeadLines initial={[]} products={productOptions} locked={false} />
      </div>
      <ChatterPlaceholder />
    </div>
    </RecordProvider>
  );
}
