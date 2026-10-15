import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ConfirmButton from "@/components/ConfirmButton";
import DatePicker from "@/components/DatePicker";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import ActionBar from "@/components/ActionBar";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import { PRIORITY_OPTIONS, TASK_LABEL, TASK_STATUSES } from "@/lib/constants";
import { fmtDate, toInputDate } from "@/lib/format";
import { changeTaskStatus, deleteTask, saveTask } from "@/app/actions/projects";

export default async function TaskDetail({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const user = await requireUser();
  const { id, taskId } = await params;
  const task = await prisma.task.findUnique({ relationLoadStrategy: "join", where: { id: taskId }, include: { project: true } });
  if (!task || task.project_id !== id) notFound();
  const [others, users] = await Promise.all([
    prisma.task.findMany({ where: { project_id: id, id: { not: taskId } }, orderBy: { start_date: "asc" }, select: { id: true, title: true } }),
    prisma.user.findMany({ where: { is_active: true, role: { in: ["SUPER_ADMIN", "PROJECT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const canEdit = can.manageProjects(user.role);

  // Status bar: To Do → In Progress → In Review → Done (dengan tanggal dari riwayat)
  const events = await prisma.activity.findMany({ where: { record_type: "task", record_id: taskId, kind: "EVENT", body: { startsWith: "Status changed" } }, orderBy: { created_at: "asc" } });
  const byLabel = Object.fromEntries(Object.entries(TASK_LABEL).map(([k, v]) => [v, k]));
  const reached: Record<string, Date> = { TODO: task.created_at };
  for (const e of events) {
    const m = /^Status changed: (.+) → (.+)$/.exec(e.body ?? "");
    if (m && byLabel[m[2]]) reached[byLabel[m[2]]] = e.created_at;
  }
  const order = TASK_STATUSES as readonly string[];
  const cur = order.indexOf(task.status);
  const steps: Step[] = order.map((s, i) => ({ status: s, label: TASK_LABEL[s], state: i === cur ? "current" : i < cur ? "done" : "todo", date: i <= cur && reached[s] ? fmtDate(reached[s]) : null }));
  const prev = cur > 0 ? order[cur - 1] : null;
  const next = cur < order.length - 1 ? order[cur + 1] : null;
  const statusButtons = canEdit && (
    <>
      {next && (
        <form action={changeTaskStatus}>
          <input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value={next} />
          <button className="btn">→ {TASK_LABEL[next]}</button>
        </form>
      )}
      {prev && (
        <form action={changeTaskStatus}>
          <input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value={prev} />
          <button className="btn">← {TASK_LABEL[prev]}</button>
        </form>
      )}
    </>
  );

  return (
    <RecordProvider listHref={`/projects/${id}`}>
      <div>
        <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: task.project.name, href: `/projects/${id}` }, { label: task.title }]} />
        <PageHeader title={task.title} subtitle={task.project.name} />
        {canEdit ? (
          <RecordBar
            createHref={`/projects/${id}/tasks/new`}
            right={<LeadStatusProgress steps={steps} />}
            extra={
              <>
              {statusButtons}
              <form action={deleteTask}>
                <input type="hidden" name="id" value={task.id} />
                <ConfirmButton danger title="Hapus task?" confirmLabel="Hapus" message="Task ini akan dihapus permanen dari project dan tidak bisa dikembalikan." className="btn btn-danger">
                  Hapus Task
                </ConfirmButton>
              </form>
              </>
            }
          />
        ) : (
          <ActionBar right={<LeadStatusProgress steps={steps} />} />
        )}
        <RecordForm action={saveTask} className="fields-compact space-y-6">
          <input type="hidden" name="id" value={task.id} />
          <Section title="Informasi Task" subtitle="Apa yang dikerjakan, statusnya, dan penanggung jawab">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <div className="md:col-span-2"><label className="label">Judul<span className="text-red-500"> *</span></label><input name="title" required defaultValue={task.title} className="input" /></div>
              <div><label className="label">Prioritas</label><Select name="priority" options={PRIORITY_OPTIONS} defaultValue={task.priority} /></div>
              <div><label className="label">Assignee</label><Select name="assignee_id" placeholder="—" options={[{ value: "", label: "—" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} defaultValue={task.assignee_id ?? ""} /></div>
            </div>
          </Section>
          <Section title="Jadwal & Dependensi" subtitle="Rentang waktu dan keterkaitan dengan task lain">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
              <div><label className="label">Mulai</label><DatePicker name="start_date" required defaultValue={toInputDate(task.start_date)} /></div>
              <div><label className="label">Tenggat</label><DatePicker name="due_date" required defaultValue={toInputDate(task.due_date)} /></div>
              <div><label className="label">Bergantung pada</label><Select name="depends_on_id" placeholder="—" options={[{ value: "", label: "—" }, ...others.map((t) => ({ value: t.id, label: t.title }))]} defaultValue={task.depends_on_id ?? ""} /></div>
            </div>
          </Section>
        </RecordForm>

        <ChatterSection type="task" id={task.id} label={task.title} />
      </div>
    </RecordProvider>
  );
}
