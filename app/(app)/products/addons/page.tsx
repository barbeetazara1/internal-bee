import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Badge, CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { ADDON_BILLING_LABEL, ADDON_KIND_LABEL } from "@/lib/addons";
import { idr } from "@/lib/format";
import { bulkAddonActive, deleteAddons } from "@/app/actions/addons";

export default async function AddonsPage() {
  const user = await requireUser();
  const editable = can.manageProducts(user.role);
  const addons = await prisma.addon.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], include: { _count: { select: { lead_addons: true } } } });
  const columns: Col[] = [
    { key: "name", label: "Add-on" },
    { key: "kind", label: "Jenis" },
    { key: "billing", label: "Periode Tagih" },
    { key: "price", label: "Harga Default" },
    { key: "used", label: "Dipakai" },
    { key: "status", label: "Status" },
  ];
  const rows: Row[] = addons.map((a) => ({
    id: a.id,
    href: editable ? `/products/addons/${a.id}` : undefined,
    cells: {
      name: { text: a.name, node: <div className={a.is_active ? "" : "opacity-50"}><div className="font-medium">{a.name}</div>{a.description && <div className="text-xs text-slate-500">{a.description}</div>}</div> },
      kind: { text: ADDON_KIND_LABEL[a.kind] ?? a.kind },
      billing: { text: ADDON_BILLING_LABEL[a.billing] ?? a.billing },
      price: { text: idr(Number(a.price)) },
      used: { text: `${a._count.lead_addons} lead` },
      status: { text: a.is_active ? "Aktif" : "Nonaktif", node: a.is_active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge> },
    },
  }));
  return (
    <div>
      <PageHeader title="Add-ons" subtitle="Biaya tambahan di luar produk (hosting, domain, SSL, maintenance) yang bisa dipasang pada lead">
        {editable && <CreateButton href="/products/addons/new">Add-on Baru</CreateButton>}
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Add-on", value: addons.length, hint: `${addons.filter((a) => a.is_active).length} aktif · ${addons.filter((a) => !a.is_active).length} nonaktif` },
          { label: "Tagihan Berulang", value: addons.filter((a) => a.billing !== "ONE_TIME").length, hint: "bulanan atau tahunan" },
          { label: "Dipasang pada Lead", value: addons.reduce((n, a) => n + a._count.lead_addons, 0), hint: "total pemasangan" },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        exportName="addons"
        searchPlaceholder="Cari add-on…"
        emptyText="Belum ada add-on."
        actions={editable ? [
          { label: "Aktifkan", run: bulkAddonActive.bind(null, true) },
          { label: "Nonaktifkan", run: bulkAddonActive.bind(null, false) },
          { label: "Delete", run: deleteAddons, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." },
        ] : undefined}
      />
    </div>
  );
}
