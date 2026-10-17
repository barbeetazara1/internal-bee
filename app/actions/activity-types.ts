"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { ACTIVITY_ICON_OPTIONS } from "@/lib/activity-types";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const LABELS = { name: "Name", icon: "Icon", sort: "Order", is_active: "Status", needs_location: "Requires location" };
const FMT = { is_active: (v: unknown) => (v ? "Active" : "Inactive"), needs_location: (v: unknown) => (v ? "Yes" : "No") };

function parse(fd: FormData) {
  const name = str(fd, "name");
  const icon = str(fd, "icon");
  const sort = Math.max(0, Math.min(9999, Math.round(Number(str(fd, "sort") || 0))));
  const fail = (error: string) => ({ ok: false as const, error });
  if (!name) return fail("Activity type name is required");
  if (name.length > 60) return fail("Activity type name is too long");
  if (!ACTIVITY_ICON_OPTIONS.some((o) => o.value === icon)) return fail("Choose an icon");
  return { ok: true as const, data: { name, icon, sort: Number.isFinite(sort) ? sort : 0, is_active: str(fd, "is_active") !== "false", needs_location: str(fd, "needs_location") === "true" } };
}

export async function createActivityType(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN");
  const p = parse(fd);
  if (!p.ok) return { ok: false, message: p.error };
  try {
    const t = await prisma.activityType.create({ data: p.data });
    await logActivity(prisma, { type: "activity_type", id: t.id, kind: "CREATED", authorId: user.id, label: t.name });
    revalidatePath("/settings/activity-types");
    return { ok: true, changed: true, message: "Data saved", redirectTo: `/settings/activity-types/${t.id}` };
  } catch {
    return { ok: false, message: "An activity type with this name already exists" };
  }
}

export async function saveActivityType(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN");
  const id = str(fd, "id");
  const cur = await prisma.activityType.findUnique({ where: { id } });
  if (!cur) return { ok: false, message: "Activity type not found" };
  const p = parse(fd);
  if (!p.ok) return { ok: false, message: p.error };
  if (cur.name === p.data.name && cur.icon === p.data.icon && cur.sort === p.data.sort && cur.is_active === p.data.is_active && cur.needs_location === p.data.needs_location) return { ok: true, changed: false, message: "No changes made" };
  try {
    await prisma.activityType.update({ where: { id }, data: p.data });
    await logActivity(prisma, { type: "activity_type", id, kind: "UPDATED", authorId: user.id, label: p.data.name, changes: diffFields(LABELS, cur, p.data, FMT) });
  } catch {
    return { ok: false, message: "An activity type with this name already exists" };
  }
  revalidatePath("/settings/activity-types");
  revalidatePath(`/settings/activity-types/${id}`);
  revalidatePath("/leads");
  return { ok: true, changed: true, message: "Data saved" };
}

export async function bulkActivityTypeActive(active: boolean, ids: string[]): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN");
  const targets = await prisma.activityType.findMany({ where: { id: { in: ids }, is_active: !active }, select: { id: true, name: true } });
  const { count } = await prisma.activityType.updateMany({ where: { id: { in: ids }, is_active: !active }, data: { is_active: active } });
  for (const t of targets) await logActivity(prisma, { type: "activity_type", id: t.id, kind: "UPDATED", authorId: user.id, label: t.name, changes: [{ field: "Status", from: active ? "Inactive" : "Active", to: active ? "Active" : "Inactive" }] });
  revalidatePath("/settings/activity-types");
  if (count === 0) return { ok: true, changed: false, message: "No changes made" };
  return { ok: true, changed: true, message: `${count} activity type(s) ${active ? "activated" : "deactivated"}` };
}

/** Jenis yang sudah dipakai activity tidak boleh dihapus (nonaktifkan saja agar riwayat tetap utuh). */
export async function deleteActivityTypes(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  const used = await prisma.leadActivity.groupBy({ by: ["type_id"], where: { type_id: { in: ids } } });
  const blocked = new Set(used.map((u) => u.type_id));
  const okIds = ids.filter((i) => !blocked.has(i));
  if (okIds.length) {
    await prisma.activityType.deleteMany({ where: { id: { in: okIds } } });
    await purgeActivities("activity_type", okIds);
  }
  revalidatePath("/settings/activity-types");
  if (okIds.length === 0) return { ok: false, message: "Can't delete: the activity type is already used by activities — set it to Inactive instead" };
  return { ok: true, changed: true, message: `${okIds.length} activity type(s) deleted${blocked.size ? ` · ${blocked.size} skipped (already used)` : ""}` };
}
