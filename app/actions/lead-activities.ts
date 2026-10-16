"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { LEAD_FINAL, LEAD_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { allSalesPersons, idsFrom, parseDuration } from "@/lib/sales";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const FINAL = LEAD_FINAL as readonly string[];

function refresh(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/activities");
}

/** Menjadwalkan activity pada sebuah lead. Tahap (stage) dicatat dari status lead saat ini. Lead yang sudah ditutup tidak bisa ditambah activity. */
export async function createLeadActivity(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const lead = await prisma.lead.findUnique({ where: { id: str(fd, "lead_id") } });
  if (!lead) return { ok: false, message: "Lead not found" };
  if (FINAL.includes(lead.status)) return { ok: false, message: "Can't add an activity to a closed lead" };
  const type = await prisma.activityType.findUnique({ where: { id: str(fd, "type_id") } });
  if (!type || !type.is_active) return { ok: false, message: "Choose an activity type" };
  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Enter an activity title" };
  if (title.length > 120) return { ok: false, message: "Activity title is too long" };
  const when = new Date(str(fd, "scheduled_at"));
  if (!str(fd, "scheduled_at") || Number.isNaN(when.getTime())) return { ok: false, message: "Choose the activity date and time" };
  const notes = str(fd, "notes");
  if (notes.length > 2000) return { ok: false, message: "Notes are too long" };
  const duration = parseDuration(fd.get("duration_minutes"));
  if (!duration) return { ok: false, message: "Duration must be between 1 and 1440 minutes" };
  const location = str(fd, "location");
  if (type.needs_location && !location) return { ok: false, message: "Enter the activity location" };
  if (location.length > 200) return { ok: false, message: "Location is too long" };
  const sales = idsFrom(fd);
  const leadSales = new Set((await prisma.lead.findUnique({ where: { id: lead.id }, select: { sales_persons: { select: { id: true } } } }))!.sales_persons.map((u) => u.id));
  if (sales.some((id) => !leadSales.has(id))) return { ok: false, message: "Sales person must be one of the lead's sales persons" };

  await prisma.leadActivity.create({
    data: { lead_id: lead.id, type_id: type.id, title, stage: lead.status, scheduled_at: when, duration_minutes: duration, location: type.needs_location ? location : null, notes: notes || null, created_by_id: user.id, sales_persons: { connect: sales.map((id) => ({ id })) } },
  });
  await logActivity(prisma, { type: "lead", id: lead.id, kind: "EVENT", authorId: user.id, label: lead.title, body: `Activity scheduled: ${type.name}: ${title} (${fmtDateTime(when)}) at ${LEAD_LABEL[lead.status]}` });
  refresh(lead.id);
  return { ok: true, changed: true, message: "Activity saved" };
}

/** Tandai selesai / kembalikan ke terjadwal. */
export async function setLeadActivityDone(id: string, done: boolean): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const a = await prisma.leadActivity.findUnique({ where: { id }, include: { lead: true, type: true } });
  if (!a) return { ok: false, message: "Activity not found" };
  if ((a.status === "DONE") === done) return { ok: true, changed: false, message: "No changes made" };
  await prisma.leadActivity.update({ where: { id }, data: { status: done ? "DONE" : "PLANNED", done_at: done ? new Date() : null } });
  await logActivity(prisma, { type: "lead", id: a.lead_id, kind: "EVENT", authorId: user.id, label: a.lead.title, body: `Activity ${done ? "done" : "reopened"}: ${a.title || a.type.name}` });
  refresh(a.lead_id);
  return { ok: true, changed: true, message: done ? "Activity marked as done" : "Activity set back to planned" };
}

export async function deleteLeadActivities(ids: string[]): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const found = await prisma.leadActivity.findMany({ where: { id: { in: ids } }, include: { lead: true, type: true } });
  if (found.length === 0) return { ok: false, message: "Activity not found" };
  await prisma.leadActivity.deleteMany({ where: { id: { in: found.map((a) => a.id) } } });
  for (const a of found) {
    await logActivity(prisma, { type: "lead", id: a.lead_id, kind: "EVENT", authorId: user.id, label: a.lead.title, body: `Activity deleted: ${a.title || a.type.name}` });
    refresh(a.lead_id);
  }
  return { ok: true, changed: true, message: `${found.length} activity(ies) deleted` };
}

/** Bulk dari halaman Activity. */
export async function bulkSetActivityDone(done: boolean, ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN", "SALES");
  const { count } = await prisma.leadActivity.updateMany({ where: { id: { in: ids }, status: done ? "PLANNED" : "DONE" }, data: { status: done ? "DONE" : "PLANNED", done_at: done ? new Date() : null } });
  revalidatePath("/activities");
  revalidatePath("/leads");
  if (count === 0) return { ok: true, changed: false, message: "No changes made" };
  return { ok: true, changed: true, message: done ? `${count} activity(ies) marked as done` : `${count} activity(ies) set back to planned` };
}

const STATUS_LABEL: Record<string, string> = { PLANNED: "Planned", DONE: "Done" };

/** Ubah activity dari form Activity: judul, jenis, jadwal, catatan, dan status. Activity pada lead yang sudah ditutup bersifat baca-saja. */
export async function saveLeadActivity(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const cur = await prisma.leadActivity.findUnique({ where: { id }, include: { lead: true, type: true } });
  if (!cur) return { ok: false, message: "Activity not found" };
  if (FINAL.includes(cur.lead.status)) return { ok: false, message: "Can't edit an activity of a closed lead" };

  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Enter an activity title" };
  if (title.length > 120) return { ok: false, message: "Activity title is too long" };
  const type = await prisma.activityType.findUnique({ where: { id: str(fd, "type_id") } });
  if (!type || (!type.is_active && type.id !== cur.type_id)) return { ok: false, message: "Choose an activity type" };
  const when = new Date(str(fd, "scheduled_at"));
  if (!str(fd, "scheduled_at") || Number.isNaN(when.getTime())) return { ok: false, message: "Choose the activity date and time" };
  const notes = str(fd, "notes");
  if (notes.length > 2000) return { ok: false, message: "Notes are too long" };
  const duration = parseDuration(fd.get("duration_minutes"));
  if (!duration) return { ok: false, message: "Duration must be between 1 and 1440 minutes" };
  const location = str(fd, "location");
  if (type.needs_location && !location) return { ok: false, message: "Enter the activity location" };
  if (location.length > 200) return { ok: false, message: "Location is too long" };
  const sales = idsFrom(fd);
  const leadSales = new Set((await prisma.lead.findUnique({ where: { id: cur.lead_id }, select: { sales_persons: { select: { id: true } } } }))!.sales_persons.map((u) => u.id));
  if (sales.some((id) => !leadSales.has(id))) return { ok: false, message: "Sales person must be one of the lead's sales persons" };
  const curSales = (await prisma.leadActivity.findUnique({ where: { id }, select: { sales_persons: { select: { id: true, name: true } } } }))!.sales_persons;
  const status = fd.has("status") ? (str(fd, "status") === "DONE" ? "DONE" : "PLANNED") : cur.status; // tanpa field status (dialog di lead) → status tidak berubah

  const changes: string[] = [];
  if ((cur.title ?? "") !== title) changes.push(`title “${cur.title ?? cur.type.name}” → “${title}”`);
  if (cur.type_id !== type.id) changes.push(`type ${cur.type.name} → ${type.name}`);
  if (cur.scheduled_at.getTime() !== when.getTime()) changes.push(`schedule ${fmtDateTime(cur.scheduled_at)} → ${fmtDateTime(when)}`);
  if ((cur.notes ?? "") !== notes) changes.push("notes");
  if ((cur.location ?? "") !== (type.needs_location ? location : "")) changes.push("location");
  if (cur.duration_minutes !== duration) changes.push(`duration ${cur.duration_minutes} → ${duration} min`);
  if ([...curSales.map((u) => u.id)].sort().join() !== [...sales].sort().join()) changes.push("sales person");
  if (cur.status !== status) changes.push(`status ${STATUS_LABEL[cur.status]} → ${STATUS_LABEL[status]}`);
  if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };

  await prisma.leadActivity.update({
    where: { id },
    data: { title, type_id: type.id, scheduled_at: when, duration_minutes: duration, location: type.needs_location ? location : null, notes: notes || null, sales_persons: { set: sales.map((sid) => ({ id: sid })) }, status, done_at: status === "DONE" ? (cur.status === "DONE" ? cur.done_at : new Date()) : null },
  });
  await logActivity(prisma, { type: "lead", id: cur.lead_id, kind: "EVENT", authorId: user.id, label: cur.lead.title, body: `Activity updated: ${title} — ${changes.join("; ")}` });
  refresh(cur.lead_id);
  revalidatePath(`/activities/${id}`);
  return { ok: true, changed: true, message: "Data saved" };
}
