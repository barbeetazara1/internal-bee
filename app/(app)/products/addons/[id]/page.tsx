import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import AddonFields from "@/components/AddonFields";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { saveAddon } from "@/app/actions/addons";

export default async function AddonDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const a = await prisma.addon.findUnique({ where: { id }, include: { _count: { select: { lead_addons: true } } } });
  if (!a) notFound();
  return (
    <RecordProvider listHref="/products/addons">
      <div>
        <Breadcrumb items={[{ label: "Product Catalog", href: "/products" }, { label: "Add-ons", href: "/products/addons" }, { label: a.name }]} />
        <PageHeader title={a.name} subtitle={`${a._count.lead_addons} lead memakai add-on ini`} />
        <RecordBar createHref="/products/addons/new" />
        <RecordForm action={saveAddon} className="fields-compact space-y-6">
          <input type="hidden" name="id" value={a.id} />
          <AddonFields a={{ name: a.name, kind: a.kind, billing: a.billing, price: Number(a.price), description: a.description, sort: a.sort }} />
        </RecordForm>
        <ChatterSection type="addon" id={a.id} label={a.name} />
      </div>
    </RecordProvider>
  );
}
