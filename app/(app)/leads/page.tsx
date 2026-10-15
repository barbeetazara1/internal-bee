import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Alert, CreateButton, PageHeader, StatusBadge, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import LeadKanban from "@/components/LeadKanban";
import ViewToggle from "@/components/ViewToggle";
import { LEAD_LABEL, LEAD_STATUSES } from "@/lib/constants";
import { fmtDate, idr } from "@/lib/format";
import { bulkDeleteLeads } from "@/app/actions/leads";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string; view?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const sp = await searchParams;
  // Default Kanban; List hanya jika dipilih lewat toggle (?view=list).
  const view: "list" | "kanban" = sp.view === "list" ? "list" : "kanban";
  const leads = await prisma.lead.findMany({
    where: view === "list" && sp.status ? { status: sp.status } : undefined,
    orderBy: { created_at: "desc" },
    include: { owner: true, client: true, products: true },
  });

  const columns: Col[] = [
    { key: "lead", label: "Lead" },
    { key: "client", label: "Client" },
    { key: "contact", label: "Kontak" },
    { key: "owner", label: "Owner" },
    { key: "value", label: "Nilai penawaran" },
    { key: "status", label: "Status" },
    { key: "created", label: "Dibuat" },
  ];
  const rows: Row[] = leads.map((l) => {
    const value = l.products.reduce((a, p) => a + Number(p.price) * p.quantity, 0);
    return {
      id: l.id,
      href: `/leads/${l.id}`,
      cells: {
        lead: { text: l.title, node: <div className="font-medium">{l.title}</div> },
        client: { text: l.client.name },
        contact: { text: `${l.contact_name} ${l.email ?? ""}`, node: <div>{l.contact_name}<div className="text-xs text-slate-500">{l.email}</div></div> },
        owner: { text: l.owner.name },
        value: { text: idr(value), node: <div>{idr(value)}<div className="text-xs text-slate-400">{l.products.length} produk</div></div> },
        status: { text: LEAD_LABEL[l.status], node: <StatusBadge status={l.status} /> },
        created: { text: fmtDate(l.created_at) },
      },
    };
  });

  // Ringkasan dihitung dari semua lead (tidak terpengaruh filter status tampilan List)
  const all = await prisma.lead.findMany({ select: { status: true, products: { select: { price: true, quantity: true } } } });
  const valueOf = (l: (typeof all)[number]) => l.products.reduce((a, p) => a + Number(p.price) * p.quantity, 0);
  const open = all.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.status));
  const won = all.filter((l) => l.status === "CLOSED_WON").length;
  const lost = all.filter((l) => l.status === "CLOSED_LOST").length;
  return (
    <div>
      <PageHeader title="Leads (CRM)" subtitle="Akuisisi lead, pemetaan produk, dan penutupan deal">
        <ViewToggle base="/leads" current={view} />
        <CreateButton href="/leads/new">Lead Baru</CreateButton>
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Lead", value: all.length, hint: `${open.length} masih berjalan` },
          { label: "Nilai Pipeline", value: idr(open.reduce((a, l) => a + valueOf(l), 0)), hint: "total penawaran lead yang masih berjalan" },
          { label: "Win Rate", value: won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—", hint: `${won} won · ${lost} lost` },
        ]}
      />
      {sp.error && <Alert>{sp.error}</Alert>}

      {view === "kanban" ? (
        <LeadKanban
          leads={leads.map((l) => ({
            id: l.id, title: l.title, client: l.client.name, contact: l.contact_name, owner: l.owner.name, status: l.status,
            value: l.products.reduce((a, p) => a + Number(p.price) * p.quantity, 0), products: l.products.length, created: fmtDate(l.created_at),
          }))}
        />
      ) : (
        <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/leads?view=list" className={`btn btn-sm ${!sp.status ? "btn-primary" : ""}`}>Semua</Link>
        {LEAD_STATUSES.map((s) => (
          <Link key={s} href={`/leads?view=list&status=${s}`} className={`btn btn-sm ${sp.status === s ? "btn-primary" : ""}`}>{LEAD_LABEL[s]}</Link>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        exportName="leads"
        searchPlaceholder="Cari lead, client, kontak…"
        emptyText="Tidak ada lead."
        actions={[{ label: "Delete", run: bulkDeleteLeads, danger: true, confirm: "Delete {n} selected lead(s)? Only leads with status \"Baru\" can be deleted; others are skipped." }]}
      />
        </>
      )}
    </div>
  );
}
