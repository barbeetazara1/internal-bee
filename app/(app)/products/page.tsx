import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Alert, Badge, CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { LICENSE_LABEL } from "@/lib/constants";
import { idr } from "@/lib/format";
import { deleteProducts, setProductsActive } from "@/app/actions/products";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { apiKeys: true } } } });
  const editable = can.manageProducts(user.role);

  const columns: Col[] = [
    { key: "product", label: "Produk" },
    { key: "license", label: "Tipe Lisensi" },
    { key: "price", label: "Harga dasar" },
    { key: "keys", label: "Key" },
    { key: "status", label: "Status" },
  ];

  const rows: Row[] = products.map((p) => ({
    id: p.id,
    href: `/products/${p.id}`,
    cells: {
      product: { text: `${p.name} ${p.code}`, node: <div className={p.is_active ? "" : "opacity-50"}><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-slate-500">{p.code}</div></div> },
      license: { text: LICENSE_LABEL[p.license_type] ?? p.license_type },
      price: { text: idr(Number(p.base_price)) },
      keys: { text: String(p._count.apiKeys) },
      status: { text: p.is_active ? "Aktif" : "Nonaktif", node: p.is_active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge> },
    },
  }));

  const top = [...products].sort((a, b) => b._count.apiKeys - a._count.apiKeys || a.name.localeCompare(b.name))[0];
  const avgPrice = products.length ? products.reduce((a, p) => a + Number(p.base_price), 0) / products.length : 0;
  return (
    <div>
      <PageHeader title="Product Catalog" subtitle="Master data produk software & layanan perusahaan">
        {editable && <CreateButton href="/products/new">Produk Baru</CreateButton>}
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Produk", value: products.length, hint: `${products.filter((p) => p.is_active).length} aktif · ${products.filter((p) => !p.is_active).length} nonaktif` },
          { label: "Produk Paling Laku", value: top && top._count.apiKeys > 0 ? top.name : "—", hint: top && top._count.apiKeys > 0 ? `${top._count.apiKeys} lisensi terjual` : "Belum ada penjualan" },
          { label: "Rata-rata Harga Dasar", value: idr(avgPrice), hint: "dari semua produk" },
        ]}
      />
      {sp.error && <Alert>{sp.error}</Alert>}

      <DataTable
        columns={columns}
        rows={rows}
        exportName="products"
        searchPlaceholder="Cari produk, kode, tipe lisensi…"
        emptyText="Belum ada produk."
        actions={editable ? [
          { label: "Aktifkan", run: setProductsActive.bind(null, true) },
          { label: "Nonaktifkan", run: setProductsActive.bind(null, false), confirm: "Nonaktifkan {n} produk terpilih?" },
          { label: "Delete", run: deleteProducts, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." },
        ] : []}
      />
    </div>
  );
}
