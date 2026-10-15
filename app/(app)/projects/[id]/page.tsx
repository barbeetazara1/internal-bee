import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Receipt } from "lucide-react";
import { Breadcrumb, CreateButton, PageHeader, SmartButton } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ActionBar from "@/components/ActionBar";
import ConfirmButton from "@/components/ConfirmButton";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import KanbanBoard from "@/components/KanbanBoard";
import GanttChart from "@/components/GanttChart";
import TerminMenu, { type Termin } from "@/components/TerminMenu";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { BILL_KIND_LABEL } from "@/lib/payment";
import { fmtDate, idr, toInputDate } from "@/lib/format";
import { setProjectStatus } from "@/app/actions/projects";

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { view = "board" } = await searchParams;
  const project = await prisma.project.findUnique({ relationLoadStrategy: "join",
    where: { id },
    include: { client: true, tasks: { orderBy: [{ start_date: "asc" }, { position: "asc" }] }, apiKeys: true },
  });
  if (!project) notFound();
  const users = await prisma.user.findMany({ where: { is_active: true, role: { in: ["SUPER_ADMIN", "PROJECT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const editable = can.manageProjects(user.role);
  // Smart button Bills: hanya untuk role yang boleh membuka menu Bills
  const bills = can.manageBills(user.role) ? await prisma.bill.findMany({ where: { project_id: id }, select: { id: true, code: true, kind: true, period_no: true, period_total: true, status: true, due_date: true, amount: true, product: { select: { code: true, name: true } } }, orderBy: [{ product_id: "asc" }, { period_no: "asc" }] }) : null;
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
      <ActionBar right={<LeadStatusProgress steps={steps} />}>
        {editable && <CreateButton href={`/projects/${project.id}/tasks/new`}>Task Baru</CreateButton>}
        <Link href={`/clients/${project.client_id}`} className="btn">Lihat Client</Link>
        {termins.length > 0 && <TerminMenu items={termins} />}
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

      {bills && (
        <div className="no-print mb-5 flex flex-wrap gap-3">
          <SmartButton
            href={`/bills?project=${project.id}`}
            icon={Receipt}
            value={bills.length}
            label={bills.length === 1 ? "Bill" : "Bills"}
            tone={overdue > 0 ? "red" : bills.length > 0 && unpaid.length === 0 ? "green" : "slate"}
            hint={bills.length === 0 ? "Belum ada bill" : overdue > 0 ? `${overdue} terlambat · ${idr(unpaid.reduce((a, b) => a + Number(b.amount), 0))}` : unpaid.length > 0 ? `${idr(unpaid.reduce((a, b) => a + Number(b.amount), 0))} belum dibayar` : "Semua lunas"}
          />
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
