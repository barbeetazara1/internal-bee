import { RecordBar, RecordProvider } from "@/components/Record";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Alert, Breadcrumb, PageHeader } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ProductForm from "@/components/ProductForm";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const canEdit = can.manageProducts(user.role);
  const { id } = await params;
  const sp = await searchParams;
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <RecordProvider listHref="/products">
    <div>
      <Breadcrumb items={[{ label: "Product Catalog", href: "/products" }, { label: p.name }]} />
      <PageHeader title={p.name} />
      {canEdit && <RecordBar createHref="/products/new" />}
      {sp.error && <Alert>{sp.error}</Alert>}
      <ProductForm p={{ ...p, base_price: Number(p.base_price) }} />
      <ChatterSection type="product" id={p.id} label={p.name} />
    </div>
    </RecordProvider>
  );
}
