import Link from "next/link";
import { prisma } from "@/lib/db";
import { can, requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader, StatusBadge, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, idr } from "@/lib/format";
import { deleteBills } from "@/app/actions/bills";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const { project: projectId } = await searchParams;
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }) : null;
  const bills = await prisma.bill.findMany({ where: project ? { project_id: project.id } : undefined, orderBy: [{ due_date: "asc" }, { code: "asc" }], include: { client: true, product: true } });
  const eff = (b: (typeof bills)[number]) => effectiveBillStatus(b);

  const columns: Col[] = [
    { key: "bill", label: "Bill" },
    { key: "client", label: "Client" },
    { key: "product", label: "Produk" },
    { key: "scheme", label: "Pembayaran" },
    { key: "period", label: "Periode" },
    { key: "amount", label: "Jumlah" },
    { key: "due", label: "Jatuh Tempo" },
    { key: "status", label: "Status" },
  ];
  const rows: Row[] = bills.map((b) => ({
    id: b.id,
    href: project ? `/bills/${b.id}?project=${project.id}` : `/bills/${b.id}`,
    group: b.client.name,
    cells: {
      bill: { text: b.code, node: <span className="font-mono text-xs font-medium">{b.code}</span> },
      client: { text: b.client.name },
      product: { text: `${b.product.code} ${b.product.name}`, node: <div><div className="font-medium">{b.product.name}</div><div className="font-mono text-xs text-slate-500">{b.product.code}</div></div> },
      scheme: { text: BILL_KIND_LABEL[b.kind] ?? b.kind },
      period: { text: `${b.period_no} / ${b.period_total}` },
      amount: { text: idr(Number(b.amount)), node: <span className="font-medium">{idr(Number(b.amount))}</span> },
      due: { text: fmtDate(b.due_date) },
      status: { text: BILL_LABEL[eff(b)], node: <StatusBadge status={eff(b)} /> },
    },
  }));

  const open = bills.filter((b) => b.status === "UNPAID");
  const overdue = bills.filter((b) => eff(b) === "OVERDUE");
  const paid = bills.filter((b) => b.status === "PAID");
  const sum = (l: typeof bills) => l.reduce((a, b) => a + Number(b.amount), 0);
  return (
    <div>
      {project && <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${project.id}` }, { label: "Bills" }]} />}
      <PageHeader title="Bills" subtitle="Tagihan client — terbentuk saat lead Closed Won, sesuai sistem pembayaran yang dipilih" />
      {project && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>Menampilkan bill dari project</span>
          <Link href={`/projects/${project.id}`} className="font-semibold underline">{project.name}</Link>
          <Link href="/bills" className="ml-auto btn btn-sm">Tampilkan semua</Link>
        </div>
      )}
      <SummaryCards
        items={[
          { label: "Belum Dibayar", value: idr(sum(open)), hint: `${open.length} bill` },
          { label: "Terlambat", value: idr(sum(overdue)), hint: `${overdue.length} bill lewat jatuh tempo` },
          { label: "Lunas", value: idr(sum(paid)), hint: `${paid.length} bill` },
        ]}
      />
      <DataTable columns={columns} rows={rows} groupLabel="Client" exportName="bills" searchPlaceholder="Cari bill, client, produk, status…" emptyText="Belum ada bill. Bill terbentuk otomatis saat sebuah lead ditutup sebagai Closed Won."
        actions={can.admin(user.role) ? [{ label: "Delete", run: deleteBills, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." }] : []}
      />
    </div>
  );
}
