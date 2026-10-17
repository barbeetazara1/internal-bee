import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Breadcrumb, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { ADDON_BILLING_LABEL, ADDON_KIND_LABEL } from "@/lib/addons";
import { SERVICE_STATE_LABEL, SERVICE_STATE_RANK, SERVICE_STATE_TONE, serviceState } from "@/lib/services";
import { fmtDate } from "@/lib/format";

const dayDiff = (d: Date, now: Date) => Math.ceil((d.getTime() - now.getTime()) / 86400000);

/** Layanan berjalan (server/hosting, domain, SSL, maintenance) dari add-on berbayar: masa aktif & status, supaya yang hampir down bisa dilacak. */
/** Daftar layanan; `kind` (HOSTING/DOMAIN/SSL/MAINTENANCE/OTHER) menyaring satu jenis saja. */
export default async function ServiceList({ kind, projectId }: { kind?: string; projectId?: string }) {
  await requireUser();
  const now = new Date();
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }) : null;
  const services = await prisma.service.findMany({
    relationLoadStrategy: "join",
    where: { ...(kind ? { kind } : {}), ...(projectId ? { project_id: projectId } : {}) },
    include: { client: { select: { id: true, name: true } }, lead: { select: { id: true, title: true } }, bills: { where: { status: "UNPAID" }, select: { due_date: true }, orderBy: { due_date: "asc" }, take: 1 } },
  });
  const items = services
    .map((s) => {
      const due = s.bills[0]?.due_date ?? null;
      return { s, due, state: serviceState(s, due, now) };
    })
    .sort((a, b) => SERVICE_STATE_RANK[a.state] - SERVICE_STATE_RANK[b.state] || (a.s.active_until?.getTime() ?? Infinity) - (b.s.active_until?.getTime() ?? Infinity));

  const count = (...st: string[]) => items.filter((i) => st.includes(i.state)).length;
  const columns: Col[] = [
    { key: "name", label: "Layanan" },
    { key: "client", label: "Client" },
    { key: "billing", label: "Penagihan" },
    { key: "until", label: "Aktif Sampai" },
    { key: "due", label: "Tagihan Berikutnya" },
    { key: "state", label: "Status" },
  ];
  const rows: Row[] = items.map(({ s, due, state }) => {
    const left = s.active_until ? dayDiff(s.active_until, now) : null;
    return {
      id: s.id,
      href: project ? `/services/${s.id}?project=${project.id}` : `/services/${s.id}`,
      group: s.client.name,
      cells: {
        name: { text: `${s.name} ${ADDON_KIND_LABEL[s.kind] ?? ""}`, node: <div><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{ADDON_KIND_LABEL[s.kind] ?? s.kind} · {s.lead.title}{s.domain_name ? ` · ${s.domain_name}` : ""}</div></div> },
        client: { text: s.client.name },
        billing: { text: `${ADDON_BILLING_LABEL[s.billing] ?? s.billing} ${s.paid_periods}/${s.periods}`, node: <div>{ADDON_BILLING_LABEL[s.billing] ?? s.billing}<div className="text-xs text-slate-400">{`${s.paid_periods} dari ${s.periods} periode terbayar`}</div></div> },
        until: {
          text: s.active_until ? fmtDate(s.active_until) : "—",
          node: s.active_until ? <div>{fmtDate(s.active_until)}<div className={`text-xs ${left! < 0 ? "text-red-600" : left! <= 14 ? "text-amber-600" : "text-slate-400"}`}>{left! < 0 ? `lewat ${-left!} hari` : left === 0 ? "berakhir hari ini" : `${left} hari lagi`}</div></div> : <span className="text-slate-400">{s.billing === "ONE_TIME" && s.paid_periods > 0 ? "Tanpa batas" : "Belum aktif"}</span>,
        },
        due: { text: due ? fmtDate(due) : "—", node: due ? <div>{fmtDate(due)}{due < now && <div className="text-xs text-red-600">terlambat {-dayDiff(due, now)} hari</div>}</div> : <span className="text-slate-400">—</span> },
        state: { text: SERVICE_STATE_LABEL[state], node: <Badge tone={SERVICE_STATE_TONE[state]}>{SERVICE_STATE_LABEL[state]}</Badge> },
      },
    };
  });

  return (
    <div>
      {project && <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${project.id}` }, { label: "Services" }]} />}
      <PageHeader title={kind ? `Services — ${ADDON_KIND_LABEL[kind] ?? kind}` : "Services"} subtitle={project ? `Layanan pada project ${project.name}` : "Server/hosting, domain, SSL, dan layanan berlangganan lain milik client — lacak masa aktif dan yang hampir down"} />
      <SummaryCards
        items={[
          { label: "Aktif", value: count("ACTIVE", "LIFETIME"), hint: `${items.length} layanan total` },
          { label: "Perlu Perhatian", value: count("EXPIRING", "AT_RISK", "PENDING"), hint: "segera berakhir, tagihan terlambat, atau belum dibayar" },
          { label: "Down / Berakhir", value: count("DOWN", "ENDED"), hint: "tidak diperpanjang atau periode selesai" },
        ]}
      />
      <DataTable columns={columns} rows={rows} exportName="services" searchPlaceholder="Cari layanan, client…" emptyText="Belum ada layanan. Layanan dibuat otomatis dari add-on berbayar saat lead Closed Won." />
      <p className="mt-3 text-xs text-slate-400">Masa aktif maju setiap tagihan layanan dibayar. <Link href="/bills" className="underline">Buka Bills</Link> untuk membayar tagihan berikutnya.</p>
    </div>
  );
}
