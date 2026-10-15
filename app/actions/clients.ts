"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const validPhone = (p: string | null) => !p || /^[0-9+()\-\s]+$/.test(p);


export async function saveClient(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const data = {
    name: str(fd, "name"),
    contact_name: str(fd, "contact_name") || null,
    email: str(fd, "email") || null,
    phone: str(fd, "phone") || null,
    country: str(fd, "country") || null,
    province: str(fd, "province") || null,
    city: str(fd, "city") || null,
    district: str(fd, "district") || null,
    postal_code: str(fd, "postal_code") || null,
    address: str(fd, "address") || null,
  };
  if (!data.name) return { ok: false, message: "Client name is required" };
  if (!data.contact_name) return { ok: false, message: "Contact name is required" };
  if (!data.email) return { ok: false, message: "Email is required" };
  if (!data.phone) return { ok: false, message: "Phone is required" };
  if (!data.address) return { ok: false, message: "Full address is required" };
  if (!validPhone(data.phone)) return { ok: false, message: "Phone may only contain digits and + ( ) -" };
  if (data.postal_code && !/^\d{3,10}$/.test(data.postal_code)) return { ok: false, message: "Postal code may only contain digits (3–10)" };

  const dup = await prisma.client.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
  if (dup) return { ok: false, message: "A client with this name already exists" };

  if (id) {
    const cur = await prisma.client.findUnique({ where: { id } });
    if (!cur) return { ok: false, message: "Client not found" };
    const changes = diffFields({ name: "Name", contact_name: "Contact", email: "Email", phone: "Phone", country: "Country", province: "Province", city: "City", district: "District / Sub-district", postal_code: "Postal code", address: "Full address" }, cur, data);
    if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };
    await prisma.client.update({ where: { id }, data });
    await logActivity(prisma, { type: "client", id, kind: "UPDATED", authorId: user.id, label: data.name, changes });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, changed: true, message: "Data saved" };
  }

  const all = await prisma.client.findMany({ select: { code: true } });
  const next = all.reduce((m, c) => Math.max(m, parseInt(c.code.replace(/\D/g, "")) || 0), 0) + 1;
  const c = await prisma.client.create({ data: { ...data, code: `CLI-${String(next).padStart(4, "0")}` } });
  await logActivity(prisma, { type: "client", id: c.id, kind: "CREATED", authorId: user.id, label: c.name });
  revalidatePath("/clients");
  return { ok: true, changed: true, message: "Data saved", redirectTo: `/clients/${c.id}` };
}

/** Client yang masih punya lead, project, atau lisensi tidak boleh dihapus. */
export async function deleteClients(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN", "SALES");
  const used = await prisma.client.findMany({ where: { id: { in: ids }, OR: [{ leads: { some: {} } }, { projects: { some: {} } }, { apiKeys: { some: {} } }] }, select: { id: true } });
  const blocked = new Set(used.map((c) => c.id));
  const okIds = ids.filter((i) => !blocked.has(i));
  await prisma.client.deleteMany({ where: { id: { in: okIds } } });
  await purgeActivities("client", okIds);
  revalidatePath("/clients");
  if (okIds.length === 0) return { ok: false, message: "Can't delete: the client still has leads, projects or licenses" };
  return { ok: true, changed: true, message: `${okIds.length} client(s) deleted${blocked.size ? ` · ${blocked.size} skipped (still has leads, projects or licenses)` : ""}` };
}
