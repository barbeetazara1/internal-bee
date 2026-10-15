import { RecordBar, RecordProvider } from "@/components/Record";
import { requireRole } from "@/lib/auth";
import { Alert, PageHeader , Breadcrumb } from "@/components/ui";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import ProductForm from "@/components/ProductForm";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("SUPER_ADMIN");
  const sp = await searchParams;
  return (
    <RecordProvider isNew listHref="/products">
    <div>
      <Breadcrumb items={[{ label: "Product Catalog", href: "/products" }, { label: "Produk Baru" }]} />
      <PageHeader title="Produk Baru" subtitle="Tambah produk ke Product Catalog" />
      <RecordBar />
      {sp.error && <Alert>{sp.error}</Alert>}
      <ProductForm />
      <ChatterPlaceholder />
    </div>
    </RecordProvider>
  );
}
