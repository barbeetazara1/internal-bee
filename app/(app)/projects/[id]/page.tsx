import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Boxes, Globe, Receipt, Server, ShieldCheck, Wrench } from "lucide-react";
import { Breadcrumb, CreateButton, PageHeader, SmartButton, SummaryCards } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import KeyReveal from "@/components/KeyReveal";
import ActionBar from "@/components/ActionBar";
import ConfirmButton from "@/components/ConfirmButton";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import KanbanBoard from "@/components/KanbanBoard";
import GanttChart from "@/components/GanttChart";
import TerminMenu, { type Termin } from "@/components/TerminMenu";
import InvoiceGroupMenu, { type InvoiceGroup } from "@/components/InvoiceGroupMenu";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { ADDON_KIND_LABEL } from "@/lib/addons";
import { SERVICE_STATE_RANK, serviceState, type ServiceState } from "@/lib/services";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, idr, jktDay, toInputDate } from "@/lib/format";
import { setProjectStatus } from "@/app/actions/projects";

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; won?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { view = "board", won } = await searchParams;
  const project = await prisma.project.findUnique({ relationLoadStrategy: "join",
    where: { id },
    include: { client: true, lead: { include: { products: { select: { price: true, quantity: true } } } }, tasks: { orderBy: [{ start_date: "asc" }, { position: "asc" }] }, apiKeys: true },
  });
  if (!project) notFound();
  const users = await prisma.user.findMany({ where: { is_active: true, role: { in: ["SUPER_ADMIN", "PROJECT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const editable = can.manageProjects(user.role);
  // Smart button Bills: hanya untuk role yang boleh membuka menu Bills
  const bills = can.manageBills(user.role) ? await prisma.bill.findMany({ where: { project_id: id }, select: { id: true, code: true, kind: true, product_id: true, service_id: true, addon_name: true, period_no: true, period_total: true, status: true, due_date: true, amount: true, product: { select: { code: true, name: true } } }, orderBy: [{ product_id: "asc" }, { period_no: "asc" }] }) : null;
  // Layanan project (server/hosting, SSL, domain, …) dipecah per jenis; tiap jenis jadi satu smart button
  const svcRows = await prisma.service.findMany({ where: { project_id: id }, include: { bills: { where: { status: "UNPAID" }, select: { due_date: true }, orderBy: { due_date: "asc" }, take: 1 } } });
  const nowD = new Date();
  const svcGroups = (["HOSTING", "SSL", "DOMAIN", "MAINTENANCE", "OTHER"] as const)
    .map((kind) => {
      const list = svcRows.filter((x) => x.kind === kind).map((x) => ({ x, state: serviceState(x, x.bills[0]?.due_date ?? null, nowD) }));
      return { kind, list };
    })
    .filter((g) => g.list.length > 0);
  const unpaid = bills?.filter((b) => b.status === "UNPAID") ?? [];
  // Termin invoice: hanya bila ada pembayaran bertahap (lebih dari satu bill per produk: DP, cicilan, atau bulanan)
  const termins: Termin[] = (bills ?? []).filter((b) => b.period_total > 1).map((b) => {
    const st = effectiveBillStatus(b);
    return {
      id: b.id, code: b.code, product: `${b.product.code} — ${b.product.name}`, kind: BILL_KIND_LABEL[b.kind] ?? b.kind, no: b.period_no, of: b.period_total,
      amount: idr(Number(b.amount)), due: fmtDate(b.due_date), status: st, statusLabel: BILL_LABEL[st],
      tone: st === "PAID" ? "green" : st === "OVERDUE" ? "red" : st === "UNPAID" ? "amber" : "slate",
      invoiceHref: `/bills/${b.id}/invoice?project=${id}`,
    };
  });
  // Ringkasan keuangan project (hanya untuk role yang boleh membuka Bills): revenue = harga produk pada lead; terbayar = bill produk berstatus lunas
  const money = (() => {
    if (!bills) return null;
    const revenue = (project.lead?.products ?? []).reduce((a, p) => a + Number(p.price) * p.quantity, 0);
    const productBills = bills.filter((b) => !b.service_id && !b.addon_name);
    const paid = productBills.filter((b) => b.status === "PAID").reduce((a, b) => a + Number(b.amount), 0);
    // Jumlah periode: satu rencana per produk (bill produk) dan per layanan (bill add-on); total periode = period_total terbesar tiap rencana
    type BillRow = NonNullable<typeof bills>[number];
    const tally = (list: BillRow[], keyOf: (b: BillRow) => string) => {
      const plans = new Map<string, { total: number; paid: number }>();
      for (const b of list) {
        const p = plans.get(keyOf(b)) ?? { total: 0, paid: 0 };
        p.total = Math.max(p.total, b.period_total);
        if (b.status === "PAID") p.paid++;
        plans.set(keyOf(b), p);
      }
      return [...plans.values()].reduce((a, p) => ({ total: a.total + p.total, paid: a.paid + p.paid }), { total: 0, paid: 0 });
    };
    const prod = tally(productBills, (b) => b.product_id);
    const svc = tally(bills.filter((b) => b.service_id), (b) => b.service_id!);
    return { revenue, paid, prod, svc, all: { total: prod.total + svc.total, paid: prod.paid + svc.paid } };
  })();
  // Invoice gabungan: tagihan (belum batal) yang jatuh tempo di hari yang sama, hanya kelompok dengan ≥ 2 tagihan
  const invoiceGroups: InvoiceGroup[] = (() => {
    const by = new Map<string, NonNullable<typeof bills>>();
    for (const b of bills ?? []) {
      if (b.status === "CANCELLED") continue;
      const k = jktDay(b.due_date);
      by.set(k, [...(by.get(k) ?? []), b]);
    }
    return [...by.entries()]
      .filter(([, list]) => list.length > 1)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, list]) => {
        const open = list.filter((b) => b.status === "UNPAID");
        const late = open.some((b) => effectiveBillStatus(b) === "OVERDUE");
        return {
          key: k, due: fmtDate(list[0].due_date), count: list.length, total: idr(list.reduce((a, b) => a + Number(b.amount), 0)),
          statusLabel: open.length === 0 ? "Lunas" : late ? "Terlambat" : "Belum dibayar", tone: open.length === 0 ? "green" : late ? "red" : "amber",
          href: `/projects/${id}/invoice?due=${k}`, items: list.map((b) => (b.addon_name ? `Add-on ${b.addon_name}` : b.product.code)),
        } as InvoiceGroup;
      });
  })();
  const overdue = bills?.filter((b) => effectiveBillStatus(b) === "OVERDUE").length ?? 0;

  const tasks = project.tasks.map((t) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority, assignee_id: t.assignee_id, depends_on_id: t.depends_on_id,
    start_date: toInputDate(t.start_date), due_date: toInputDate(t.due_date),
  }));
  // Status project: Active → (On Hold) → Completed
  const events = await prisma.activity.findMany({ where: { record_type: "project", record_id: id, kind: "EVENT", body: { startsWith: "Project status changed" } }, orderBy: { created_at: "asc" } });
  const reached: Record<string, Date> = { ACTIVE: project.created_at };
  for (const e of events) {
    const m = /^Project status changed: (\w+) → (\w+)$/.exec(e.body ?? "");
    if (m) reached[m[2]] = e.created_at;
  }
  const PLABEL: Record<string, string> = { ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed" };
  const flow = project.status === "ON_HOLD" ? ["ACTIVE", "ON_HOLD", "COMPLETED"] : ["ACTIVE", "COMPLETED"];
  const idx = flow.indexOf(project.status);
  const steps: Step[] = flow.map((s, i) => ({ status: s, label: PLABEL[s], state: s === project.status ? "current" : project.status === "COMPLETED" || i < idx ? "done" : "todo", date: reached[s] ? fmtDate(reached[s]) : null }));
  const moves: { to: string; label: string; confirm?: string }[] =
    project.status === "ACTIVE" ? [{ to: "ON_HOLD", label: "Tahan Project" }, { to: "COMPLETED", label: "Tandai Selesai", confirm: "Project ditandai selesai. Anda masih bisa membukanya kembali." }]
    : project.status === "ON_HOLD" ? [{ to: "ACTIVE", label: "Lanjutkan" }, { to: "COMPLETED", label: "Tandai Selesai", confirm: "Project ditandai selesai. Anda masih bisa membukanya kembali." }]
    : [{ to: "ACTIVE", label: "Buka Kembali" }];
  const tabs = [["board", "Sprint Kanban"], ["gantt", "Gantt Chart"]] as const;

  return (
    <div>
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: project.name }]} />
      <PageHeader title={project.name} subtitle={`${project.client.name} · ${fmtDate(project.start_date)} → ${fmtDate(project.end_date)}`} />
      {won && <KeyReveal />}
      <ActionBar right={<LeadStatusProgress steps={steps} />}>
        {editable && <CreateButton href={`/projects/${project.id}/tasks/new`}>Task Baru</CreateButton>}
        <Link href={`/clients/${project.client_id}`} className="btn">Lihat Client</Link>
        {termins.length > 0 && <TerminMenu items={termins} />}
        {invoiceGroups.length > 0 && <InvoiceGroupMenu groups={invoiceGroups} />}
        {editable &&
          moves.map((m) => (
            <form key={m.to} action={setProjectStatus}>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="status" value={m.to} />
              {m.confirm ? (
                <ConfirmButton title={`${m.label}?`} confirmLabel={m.label} message={m.confirm} className="btn">{m.label}</ConfirmButton>
              ) : (
                <button className="btn">{m.label}</button>
              )}
            </form>
          ))}
      </ActionBar>

      {money && (
        <SummaryCards
          items={[
            { label: "Total Revenue Project", value: idr(money.revenue), hint: "dari produk pada lead" },
            { label: "Total Sudah Dibayar", value: idr(money.paid), hint: money.revenue > 0 ? `${Math.round((money.paid / money.revenue) * 100)}% dari revenue produk · sisa ${idr(Math.max(0, money.revenue - money.paid))}` : "dari bill produk yang lunas" },
            { label: "Pembayaran Periode", value: `${money.all.paid} / ${money.all.total}`, hint: `Produk ${money.prod.paid}/${money.prod.total} · Services ${money.svc.paid}/${money.svc.total}` },
          ]}
        />
      )}
      {(bills || svcGroups.length > 0) && (
        <div className="no-print mb-5 flex flex-wrap gap-3">
          {svcGroups.map((g) => {
            const worst = g.list.reduce<ServiceState>((a, b) => (SERVICE_STATE_RANK[b.state] < SERVICE_STATE_RANK[a] ? b.state : a), g.list[0].state);
            const bad = g.list.filter((r) => r.state === "DOWN" || r.state === "AT_RISK").length;
            const soon = g.list.filter((r) => r.state === "EXPIRING" || r.state === "PENDING" || r.state === "ENDED").length; // ENDED = periode terakhir selesai, perlu diperpanjang
            const until = g.list.map((r) => r.x.active_until).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
            const Icon = { HOSTING: Server, SSL: ShieldCheck, DOMAIN: Globe, MAINTENANCE: Wrench, OTHER: Boxes }[g.kind];
            return (
              <SmartButton
                key={g.kind}
                href={`/services/type/${g.kind.toLowerCase()}?project=${project.id}`}
                icon={Icon}
                value={g.list.length}
                label={ADDON_KIND_LABEL[g.kind]}
                tone={bad > 0 || worst === "DOWN" ? "red" : soon > 0 ? "amber" : "green"}
                hint={bad > 0 ? `${bad} berisiko / down` : soon > 0 ? `${soon} perlu perhatian` : until ? `Aktif sampai ${fmtDate(until)}` : "Aktif"}
              />
            );
          })}
          {bills && <SmartButton
            href={`/bills?project=${project.id}`}
            icon={Receipt}
            value={bills.length}
            label={bills.length === 1 ? "Bill" : "Bills"}
            tone={overdue > 0 ? "red" : bills.length > 0 && unpaid.length === 0 ? "green" : "slate"}
            hint={bills.length === 0 ? "Belum ada bill" : overdue > 0 ? `${overdue} terlambat · ${idr(unpaid.reduce((a, b) => a + Number(b.amount), 0))}` : unpaid.length > 0 ? `${idr(unpaid.reduce((a, b) => a + Number(b.amount), 0))} belum dibayar` : "Semua lunas"}
          />}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/projects/${id}?view=${k}`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${view === k ? "border-amber-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</Link>
        ))}
      </div>

      {view === "gantt" ? <GanttChart projectId={project.id} tasks={tasks} /> : <KanbanBoard projectId={project.id} tasks={tasks} users={users} editable={editable} />}

      <ChatterSection type="project" id={project.id} label={project.name} />
    </div>
  );
}
