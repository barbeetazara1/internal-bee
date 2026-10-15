import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { PageHeader, StatusBadge, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { fmtDate } from "@/lib/format";
import { bulkProjectStatus, deleteProjects } from "@/app/actions/projects";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "ACTIVE", ON_HOLD: "ON HOLD", COMPLETED: "COMPLETED" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({ orderBy: { created_at: "desc" }, include: { client: true, tasks: { select: { status: true, due_date: true } } } });

  const columns: Col[] = [
    { key: "project", label: "Project" },
    { key: "client", label: "Client" },
    { key: "period", label: "Periode" },
    { key: "progress", label: "Progress" },
    { key: "status", label: "Status" },
  ];
  const rows: Row[] = projects.map((p) => {
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
    return {
      id: p.id,
      href: `/projects/${p.id}`,
      group: p.client.name,
      cells: {
        project: { text: p.name, node: <div className="font-medium">{p.name}</div> },
        client: { text: p.client.name },
        period: { text: `${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}` },
        progress: {
          text: `${done}/${p.tasks.length} task (${pct}%)`,
          node: (
            <div className="w-40">
              <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{done}/{p.tasks.length} task</span><span>{pct}%</span></div>
              <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
            </div>
          ),
        },
        status: { text: STATUS_LABEL[p.status] ?? p.status, node: <StatusBadge status={p.status} /> },
      },
    };
  });

  const allTasks = projects.flatMap((p) => p.tasks);
  const doneTasks = allTasks.filter((t) => t.status === "DONE").length;
  const overdue = allTasks.filter((t) => t.status !== "DONE" && t.due_date.getTime() < Date.now()).length;
  return (
    <div>
      <PageHeader title="Projects" subtitle="Dibuat otomatis dari lead Closed Won — Kanban & Gantt" />
      <SummaryCards
        items={[
          { label: "Total Project", value: projects.length, hint: `${projects.filter((p) => p.status === "ACTIVE").length} aktif · ${projects.filter((p) => p.status === "COMPLETED").length} selesai` },
          { label: "Progress Rata-rata", value: allTasks.length ? `${Math.round((doneTasks / allTasks.length) * 100)}%` : "—", hint: `${doneTasks} dari ${allTasks.length} task selesai` },
          { label: "Task Terlambat", value: overdue, hint: "melewati tenggat & belum Done" },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        groupLabel="Client"
        exportName="projects"
        searchPlaceholder="Cari project, client, status…"
        emptyText="Belum ada project."
        actions={can.manageProjects(user.role) ? [
          { label: "Ubah Status → Active", run: bulkProjectStatus.bind(null, "ACTIVE") },
          { label: "Ubah Status → On Hold", run: bulkProjectStatus.bind(null, "ON_HOLD") },
          { label: "Ubah Status → Completed", run: bulkProjectStatus.bind(null, "COMPLETED") },
          ...(user.role === "SUPER_ADMIN" ? [{ label: "Delete", run: deleteProjects, danger: true, confirm: "Delete {n} selected project(s) with all their tasks? Licenses are kept. This can't be undone." }] : []),
        ] : []}
      />
    </div>
  );
}
