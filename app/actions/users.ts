"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { ROLE_LABEL } from "@/lib/constants";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const LABELS = { name: "Name", email: "Email", role: "Role", is_active: "Status" };
const FMT = { role: (v: unknown) => ROLE_LABEL[String(v)] ?? String(v), is_active: (v: unknown) => (v ? "Active" : "Inactive") };

export async function createUser(fd: FormData): Promise<ActionResult> {
  const admin = await requireRole("SUPER_ADMIN");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!str(fd, "name") || !email || password.length < 8) return { ok: false, message: "Name, email and a password of at least 8 characters are required" };
  try {
    const u = await prisma.user.create({ data: { name: str(fd, "name"), email, role: str(fd, "role"), password_hash: await bcrypt.hash(password, 10) } });
    await logActivity(prisma, { type: "user", id: u.id, kind: "CREATED", authorId: admin.id, label: u.name, body: `${u.email} · ${ROLE_LABEL[u.role] ?? u.role}` });
    revalidatePath("/settings/users");
    return { ok: true, changed: true, message: "Data saved", redirectTo: `/settings/users/${u.id}` };
  } catch {
    return { ok: false, message: "Email is already registered" };
  }
}

export async function saveUser(fd: FormData): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const id = str(fd, "id");
  const cur = await prisma.user.findUnique({ where: { id } });
  if (!cur) return { ok: false, message: "User not found" };
  const self = cur.id === me.id; // akun sendiri: role & status tidak boleh diubah
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  if (!name || !email) return { ok: false, message: "Name and email are required" };
  const role = self ? cur.role : str(fd, "role") || cur.role;
  if (!["SUPER_ADMIN", "SALES", "PROJECT"].includes(role)) return { ok: false, message: "Invalid role" };
  const is_active = self ? cur.is_active : str(fd, "is_active") !== "false";

  const changed = cur.name !== name || cur.email !== email || cur.role !== role || cur.is_active !== is_active;
  if (!changed) return { ok: true, changed: false, message: "No changes made" };
  try {
    await prisma.user.update({ where: { id }, data: { name, email, role, is_active } });
    await logActivity(prisma, { type: "user", id, kind: "UPDATED", authorId: me.id, label: name, changes: diffFields(LABELS, cur, { name, email, role, is_active }, FMT) });
  } catch {
    return { ok: false, message: "Email is already registered" };
  }
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}`);
  return { ok: true, changed: true, message: "Data saved" };
}

export async function bulkUserActive(active: boolean, ids: string[]) {
  const me = await requireRole("SUPER_ADMIN");
  const targets = await prisma.user.findMany({ where: { id: { in: ids.filter((i) => i !== me.id) }, is_active: !active }, select: { id: true, name: true } });
  await prisma.user.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { is_active: active } });
  for (const t of targets) await logActivity(prisma, { type: "user", id: t.id, kind: "UPDATED", authorId: me.id, label: t.name, changes: [{ field: "Status", from: active ? "Inactive" : "Active", to: active ? "Active" : "Inactive" }] });
  revalidatePath("/settings/users");
}

/** User yang sudah punya lead atau riwayat aktivitas tidak boleh dihapus (nonaktifkan saja). */
export async function deleteUsers(ids: string[]): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  let deleted = 0;
  let skipped = 0;
  for (const id of ids.filter((i) => i !== me.id)) {
    const [leads, acts] = await Promise.all([prisma.lead.count({ where: { owner_id: id } }), prisma.activity.count({ where: { author_id: id } })]);
    if (leads || acts) {
      skipped++;
      continue;
    }
    await prisma.notification.deleteMany({ where: { user_id: id } });
    await prisma.task.updateMany({ where: { assignee_id: id }, data: { assignee_id: null } });
    await prisma.user.delete({ where: { id } });
    await purgeActivities("user", [id]);
    deleted++;
  }
  revalidatePath("/settings/users");
  if (!deleted) return { ok: false, message: "Can't delete: the user already has leads or activity history — set the user to Inactive instead" };
  return { ok: true, changed: true, message: `${deleted} user(s) deleted${skipped ? ` · ${skipped} skipped (has leads or activity)` : ""}` };
}

/** Ganti password: wajib menyertakan password lama. Hanya untuk akun sendiri atau oleh Super Admin. */
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<ActionResult> {
  const me = await requireUser();
  if (me.id !== userId && me.role !== "SUPER_ADMIN") return { ok: false, message: "You can only change your own password" };
  if (!oldPassword) return { ok: false, message: "Current password is required" };
  if (newPassword.length < 8) return { ok: false, message: "New password must be at least 8 characters" };
  if (newPassword === oldPassword) return { ok: false, message: "New password must be different from the current password" };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, message: "User not found" };
  if (!(await bcrypt.compare(oldPassword, target.password_hash))) return { ok: false, message: "Current password is incorrect" };
  await prisma.user.update({ where: { id: userId }, data: { password_hash: await bcrypt.hash(newPassword, 10) } });
  await logActivity(prisma, { type: "user", id: userId, kind: "EVENT", authorId: me.id, label: target.name, body: "Password changed" });
  return { ok: true, changed: true, message: "Password changed" };
}
