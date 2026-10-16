import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import MultiSelect from "@/components/MultiSelect";
import { SALES_ROLES } from "@/lib/sales";
import ClientPicker from "@/components/ClientPicker";
import PhoneInput from "@/components/PhoneInput";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import LeadActivities from "@/components/LeadActivities";
import LeadLines from "@/components/LeadLines";
import LeadStatusProgress from "@/components/LeadStatusProgress";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { Alert, PageHeader , Breadcrumb } from "@/components/ui";
import { createLead } from "@/app/actions/leads";

export default async function NewLead({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireRole("SUPER_ADMIN", "SALES");
  const sp = await searchParams;
  const [clients, products, salesUsers, actTypes] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { is_active: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { is_active: true, role: { in: SALES_ROLES } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.activityType.findMany({ where: { is_active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] }),
  ]);
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
      <Breadcrumb items={[{ label: "Opportunities" }, { label: "Leads", href: "/leads" }, { label: "Lead Baru" }]} />
      <PageHeader title="Lead Baru" subtitle="Isi detail lead dan produk yang diminati, lalu Save" />
      <RecordBar right={<LeadStatusProgress steps={steps} />} />
      {sp.error && <Alert>{sp.error}</Alert>}
      <RecordForm action={createLead} className="fields-compact">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Section title="Detail Lead" subtitle="Peluang, prioritas, dan sumbernya">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Judul peluang</label><input name="title" className="input" placeholder="(opsional — otomatis dari nama client)" /></div>
            <div><label className="label">Prioritas</label><Select name="priority" options={PRIORITY_OPTIONS} defaultValue="MEDIUM" /></div>
            <div><label className="label">Sumber</label><input name="source" className="input" placeholder="Referral, Website, …" /></div>
            <div className="sm:col-span-2">
              <label className="label">Sales Person</label>
              <input type="hidden" name="sales_person_marker" value="1" />
              <MultiSelect name="sales_person_ids" options={salesUsers.map((u) => ({ value: u.id, label: u.name }))} defaultValue={salesUsers.some((u) => u.id === me.id) ? [me.id] : []} placeholder="Pilih sales person…" />
            </div>
            <div className="sm:col-span-2"><label className="label">Catatan</label><textarea name="notes" rows={3} className="input" /></div>
          </div>
        </Section>
        <Section title="Detail Client" subtitle="Client dan kontak yang dihubungi">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Client<span className="text-red-500"> *</span> <Link href="/clients/new" className="ml-1 font-normal text-amber-600 hover:underline">+ Client Baru</Link></label><ClientPicker options={clients.map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }))} /></div>
            <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required className="input" /></div>
            <div><label className="label">Telepon<span className="text-red-500"> *</span></label><PhoneInput name="phone" required className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Email</label><input name="email" type="email" className="input" /></div>
          </div>
        </Section>
        </div>
      </RecordForm>

      <div className="mt-6">
        <LeadLines initial={[]} products={productOptions} locked={false} />
      </div>
      <LeadActivities types={actTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon, needs_location: t.needs_location }))} salesUsers={salesUsers} />
      <ChatterPlaceholder />
    </div>
    </RecordProvider>
  );
}
