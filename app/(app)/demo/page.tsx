import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { DEMO_LABEL, DEMO_TONE } from "@/lib/constants";
import { effectiveDemoStatus } from "@/lib/demo";
import { fmtDate } from "@/lib/format";
import { deleteDemos } from "@/app/actions/demo";

export default async function DemoPage() {
  const user = await requireUser();
  const demos = await prisma.demo.findMany({ orderBy: { created_at: "desc" }, include: { client: true, product: true } });
  const canManage = user.role !== "PROJECT";

  const columns: Col[] = [
    { key: "code", label: "Kode" },
    { key: "client", label: "Client" },
    { key: "product", label: "Aplikasi" },
    { key: "contact", label: "Kontak" },
    { key: "status", label: "Status" },
    { key: "days", label: "Lama" },
    { key: "ends", label: "Berakhir" },
    { key: "requested", label: "Diminta" },
  ];
  const rows: Row[] = demos.map((d) => {
    const st = effectiveDemoStatus(d);
    return {
      id: d.id,
      href: `/demo/${d.id}`,
      cells: {
        code: { text: d.code, node: <span className="font-mono text-xs">{d.code}</span> },
        client: { text: d.client.name, node: <div className="font-medium">{d.client.name}</div> },
        product: { text: `${d.product.name} ${d.product.code}`, node: <div>{d.product.name}<div className="font-mono text-xs text-slate-500">{d.product.code}</div></div> },
        contact: { text: `${d.contact_name} ${d.email ?? ""}`, node: <div>{d.contact_name}<div className="text-xs text-slate-500">{d.email}</div></div> },
        status: { text: DEMO_LABEL[st], node: <Badge tone={DEMO_TONE[st]}>{DEMO_LABEL[st]}</Badge> },
        days: { text: `${d.demo_days} hari` },
        ends: { text: fmtDate(d.ends_at) },
        requested: { text: fmtDate(d.created_at) },
      },
    };
  });

  const eff = demos.map(effectiveDemoStatus);
  const running = demos.filter((d, i) => eff[i] === "ACTIVE");
  const soon = running.filter((d) => d.ends_at && d.ends_at.getTime() - Date.now() <= 3 * 86400000).length;
  return (
    <div>
      <PageHeader title="Demo" subtitle="Permintaan demo aplikasi dari client — memunculkan license key demo">
        {canManage && <CreateButton href="/demo/new">Demo Baru</CreateButton>}
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Demo", value: demos.length, hint: `${eff.filter((s) => s === "REQUESTED").length} menunggu dimulai` },
          { label: "Demo Berjalan", value: running.length, hint: `${soon} berakhir ≤ 3 hari` },
          { label: "Demo Selesai", value: eff.filter((s) => s === "ENDED").length, hint: `${eff.filter((s) => s === "CANCELLED").length} dibatalkan` },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        exportName="demo"
        searchPlaceholder="Cari demo, client, produk…"
        emptyText="Belum ada permintaan demo."
        actions={canManage ? [{ label: "Delete", run: deleteDemos, danger: true, confirm: "Delete {n} selected demo(s) and their demo license? Running demos are skipped. This can't be undone." }] : []}
      />
    </div>
  );
}
