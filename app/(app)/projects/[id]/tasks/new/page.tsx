import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import DatePicker from "@/components/DatePicker";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { toInputDate } from "@/lib/format";
import { createTask } from "@/app/actions/projects";

export default async function NewTask({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "PROJECT");
  const { id } = await params;
  const project = await prisma.project.findUnique({ relationLoadStrategy: "join", where: { id }, include: { tasks: { orderBy: { start_date: "asc" }, select: { id: true, title: true } } } });
  if (!project) notFound();
  const users = await prisma.user.findMany({ where: { is_active: true, role: { in: ["SUPER_ADMIN", "PROJECT"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const today = toInputDate(new Date());
  return (
    <RecordProvider isNew listHref="/projects">
    <div>
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${project.id}` }, { label: "Task Baru" }]} />
      <PageHeader title="Task Baru" subtitle={project.name} />
      <RecordBar />
      <RecordForm action={createTask} className="fields-compact space-y-6">
        <input type="hidden" name="project_id" value={project.id} />
        <Section title="Informasi Task" subtitle="Apa yang dikerjakan dan siapa penanggung jawabnya">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <div className="md:col-span-2"><label className="label">Judul<span className="text-red-500"> *</span></label><input name="title" required className="input" /></div>
            <div><label className="label">Prioritas</label><Select name="priority" options={PRIORITY_OPTIONS} defaultValue="MEDIUM" /></div>
            <div><label className="label">Assignee</label><Select name="assignee_id" placeholder="—" options={[{ value: "", label: "—" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} /></div>
          </div>
        </Section>
        <Section title="Jadwal & Dependensi" subtitle="Rentang waktu dan keterkaitan dengan task lain">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
            <div><label className="label">Mulai</label><DatePicker name="start_date" required defaultValue={today} /></div>
            <div><label className="label">Tenggat</label><DatePicker name="due_date" required defaultValue={today} /></div>
            <div><label className="label">Bergantung pada</label><Select name="depends_on_id" placeholder="—" options={[{ value: "", label: "—" }, ...project.tasks.map((t) => ({ value: t.id, label: t.title }))]} /></div>
          </div>
        </Section>
      </RecordForm>
      <ChatterPlaceholder />
    </div>
    </RecordProvider>
  );
}
