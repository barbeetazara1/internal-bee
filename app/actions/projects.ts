"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/lib/result";
import { logActivity, purgeActivities, type Change } from "@/lib/activity";
import { TASK_LABEL } from "@/lib/constants";
import { TASK_STATUSES } from "@/lib/constants";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createTask(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const project_id = str(fd, "project_id");
  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Task title is required" };
  const start = new Date(str(fd, "start_date") || Date.now());
  const due = new Date(str(fd, "due_date") || start);
  const created = await prisma.task.create({
    data: {
      project_id,
      title,
      priority: str(fd, "priority") || "MEDIUM",
      assignee_id: str(fd, "assignee_id") || null,
      depends_on_id: str(fd, "depends_on_id") || null,
      start_date: start,
      due_date: due < start ? start : due,
    },
  });
  await logActivity(prisma, { type: "task", id: created.id, kind: "CREATED", authorId: user.id, label: title });
  await logActivity(prisma, { type: "project", id: project_id, kind: "EVENT", authorId: user.id, body: `Task created: ${title}` });
  revalidatePath(`/projects/${project_id}`);
  return { ok: true, changed: true, message: "Data saved", redirectTo: `/projects/${project_id}/tasks/${created.id}` };
}

export async function saveTask(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const id = str(fd, "id");
  const cur = await prisma.task.findUnique({ relationLoadStrategy: "join", where: { id }, include: { assignee: true, depends_on: true } });
  if (!cur) return { ok: false, message: "Task not found" };

  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Task title is required" };
  const status = str(fd, "status") || cur.status; // status diubah lewat status bar, bukan field form
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Invalid status" };
  const priority = str(fd, "priority");
  if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) return { ok: false, message: "Invalid priority" };
  const start = new Date(str(fd, "start_date"));
  const due = new Date(str(fd, "due_date"));
  if (isNaN(+start) || isNaN(+due)) return { ok: false, message: "Start and due dates are required" };
  if (due < start) return { ok: false, message: "Due date can't be before the start date" };
  const assignee_id = str(fd, "assignee_id") || null;
  const depends_on_id = str(fd, "depends_on_id") || null;
  if (depends_on_id === id) return { ok: false, message: "A task can't depend on itself" };

  const [assignee, dep] = await Promise.all([
    assignee_id ? prisma.user.findUnique({ where: { id: assignee_id } }) : null,
    depends_on_id ? prisma.task.findUnique({ where: { id: depends_on_id } }) : null,
  ]);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const changes: Change[] = [];
  const diff = (field: string, a: string, b: string) => a !== b && changes.push({ field, from: a || "—", to: b || "—" });
  diff("Title", cur.title, title);
  diff("Status", TASK_LABEL[cur.status], TASK_LABEL[status]);
  diff("Priority", cur.priority, priority);
  diff("Start", day(cur.start_date), day(start));
  diff("Due", day(cur.due_date), day(due));
  diff("Assignee", cur.assignee?.name ?? "", assignee?.name ?? "");
  diff("Depends on", cur.depends_on?.title ?? "", dep?.title ?? "");
  if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };

  await prisma.task.update({ where: { id }, data: { title, status, priority, start_date: start, due_date: due, assignee_id, depends_on_id } });
  await logActivity(prisma, { type: "project", id: cur.project_id, kind: "EVENT", authorId: user.id, body: `Task "${title}" updated — ${changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; ")}` });
  await logActivity(prisma, { type: "task", id, kind: "UPDATED", authorId: user.id, label: title, changes });
  revalidatePath(`/projects/${cur.project_id}`);
  revalidatePath(`/projects/${cur.project_id}/tasks/${id}`);
  return { ok: true, changed: true, message: "Data saved" };
}

export async function moveTask(id: string, status: string) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return;
  const prev = await prisma.task.findUnique({ where: { id } });
  const task = await prisma.task.update({ where: { id }, data: { status } });
  if (prev && prev.status !== status) await logActivity(prisma, { type: "task", id, kind: "EVENT", authorId: user.id, label: task.title, body: `Status changed: ${TASK_LABEL[prev.status]} → ${TASK_LABEL[status]}` });
  if (prev && prev.status !== status) await logActivity(prisma, { type: "project", id: task.project_id, kind: "EVENT", authorId: user.id, body: `Task "${task.title}" moved: ${TASK_LABEL[prev.status]} → ${TASK_LABEL[status]}` });
  revalidatePath(`/projects/${task.project_id}`);
  revalidatePath(`/projects/${task.project_id}/tasks/${id}`);
}

/** Dipakai tombol status di halaman task (form action). */
export async function changeTaskStatus(fd: FormData) {
  await moveTask(str(fd, "id"), str(fd, "status"));
}

export async function deleteTask(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const task = await prisma.task.delete({ where: { id: str(fd, "id") } });
  await logActivity(prisma, { type: "project", id: task.project_id, kind: "EVENT", authorId: user.id, body: `Task deleted: ${task.title}` });
  await purgeActivities("task", [task.id]);
  revalidatePath(`/projects/${task.project_id}`);
  redirect(`/projects/${task.project_id}`);
}

export async function setProjectStatus(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const id = str(fd, "id");
  const prev = await prisma.project.findUnique({ where: { id } });
  await prisma.project.update({ where: { id }, data: { status: str(fd, "status") } });
  if (prev && prev.status !== str(fd, "status")) await logActivity(prisma, { type: "project", id, kind: "EVENT", authorId: user.id, body: `Project status changed: ${prev.status} → ${str(fd, "status")}` });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function bulkProjectStatus(status: string, ids: string[]) {
  await requireRole("SUPER_ADMIN", "PROJECT");
  if (!["ACTIVE", "ON_HOLD", "COMPLETED"].includes(status)) return;
  await prisma.project.updateMany({ where: { id: { in: ids } }, data: { status } });
  revalidatePath("/projects");
}

export async function deleteProjects(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  await prisma.apiKey.updateMany({ where: { project_id: { in: ids } }, data: { project_id: null } }); // lisensi tetap ada
  await prisma.project.deleteMany({ where: { id: { in: ids } } }); // task ikut terhapus (cascade)
  await purgeActivities("project", ids);
  revalidatePath("/projects");
  revalidatePath("/licenses");
  return { ok: true, changed: true, message: `${ids.length} project(s) deleted` };
}
