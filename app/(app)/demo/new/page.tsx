import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import DemoForm from "@/components/DemoForm";
import { RecordBar, RecordProvider } from "@/components/Record";

export default async function NewDemo() {
  await requireRole("SUPER_ADMIN", "SALES");
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { is_active: true }, orderBy: { code: "asc" } }),
  ]);
  return (
    <RecordProvider isNew listHref="/demo">
      <div>
        <Breadcrumb items={[{ label: "Demo", href: "/demo" }, { label: "Demo Baru" }]} />
        <PageHeader title="Demo Baru" subtitle="Catat permintaan demo dari client, lalu mulai demo untuk membuat license key demo" />
        <RecordBar />
        <DemoForm clients={clients.map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }))} products={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
        <ChatterPlaceholder />
      </div>
    </RecordProvider>
  );
}
