import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import { deleteClients } from "@/app/actions/clients";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { fmtDate } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await prisma.client.findMany({ relationLoadStrategy: "join", orderBy: { created_at: "desc" }, include: { apiKeys: { where: { kind: "PRODUCTION" } }, projects: true, leads: true } });

  const columns: Col[] = [
    { key: "client", label: "Client" },
    { key: "contact", label: "Kontak" },
    { key: "leads", label: "Lead" },
    { key: "licenses", label: "Lisensi aktif" },
    { key: "projects", label: "Project" },
    { key: "since", label: "Sejak" },
  ];
  const rows: Row[] = clients.map((c) => ({
    id: c.id,
    href: `/clients/${c.id}`,
    cells: {
      client: { text: `${c.name} ${c.code}`, node: <div><div className="font-medium">{c.name}</div><div className="font-mono text-xs text-slate-500">{c.code}</div></div> },
      contact: { text: `${c.contact_name ?? ""} ${c.email ?? ""}`, node: <div>{c.contact_name}<div className="text-xs text-slate-500">{c.email}</div></div> },
      leads: { text: String(c.leads.length) },
      licenses: { text: `${c.apiKeys.filter((k) => effectiveStatus(k) === "ACTIVE").length} / ${c.apiKeys.length}` },
      projects: { text: String(c.projects.length) },
      since: { text: fmtDate(c.created_at) },
    },
  }));

  const activeKeys = (c: (typeof clients)[number]) => c.apiKeys.filter((k) => effectiveStatus(k) === "ACTIVE").length;
  const withActive = clients.filter((c) => activeKeys(c) > 0).length;
  const biggest = [...clients].sort((a, b) => b.apiKeys.length - a.apiKeys.length || a.name.localeCompare(b.name))[0];
  return (
    <div>
      <PageHeader title="Clients" subtitle="Master data perusahaan client — dipilih saat membuat Lead">
        {can.manageLeads(user.role) && <CreateButton href="/clients/new">Client Baru</CreateButton>}
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Client", value: clients.length, hint: `${clients.reduce((a, c) => a + c.leads.length, 0)} lead tercatat` },
          { label: "Client dengan Lisensi Aktif", value: withActive, hint: clients.length ? `${Math.round((withActive / clients.length) * 100)}% dari semua client` : undefined },
          { label: "Client Lisensi Terbanyak", value: biggest && biggest.apiKeys.length > 0 ? biggest.name : "—", hint: biggest && biggest.apiKeys.length > 0 ? `${biggest.apiKeys.length} lisensi` : "Belum ada lisensi" },
        ]}
      />
      <DataTable columns={columns} rows={rows} exportName="clients" searchPlaceholder="Cari client, kode, kontak…" emptyText="Belum ada client. Buat client terlebih dahulu, lalu pilih saat membuat Lead."
        actions={can.manageLeads(user.role) ? [{ label: "Delete", run: deleteClients, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." }] : []}
      />
    </div>
  );
}
