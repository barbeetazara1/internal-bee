import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import AddonFields from "@/components/AddonFields";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import { createAddon } from "@/app/actions/addons";

export default async function NewAddon() {
  await requireRole("SUPER_ADMIN");
  return (
    <RecordProvider isNew listHref="/products/addons">
      <div>
        <Breadcrumb items={[{ label: "Product Catalog", href: "/products" }, { label: "Add-ons", href: "/products/addons" }, { label: "Add-on Baru" }]} />
        <PageHeader title="Add-on Baru" subtitle="Tambah biaya tambahan yang bisa dipasang pada lead" />
        <RecordBar />
        <RecordForm action={createAddon} className="fields-compact space-y-6">
          <AddonFields />
        </RecordForm>
        <ChatterPlaceholder />
      </div>
    </RecordProvider>
  );
}
