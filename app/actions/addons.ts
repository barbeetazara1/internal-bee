"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { idr } from "@/lib/format";
import { ADDON_BILLING_LABEL, ADDON_KIND_LABEL } from "@/lib/addons";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const u = await requireUser();
  if (!can.manageProducts(u.role)) throw new Error("Forbidden");
  return u;
}

const LABELS = { name: "Name", kind: "Type", billing: "Billing period", price: "Default price", description: "Description", sort: "Order" };
const FMT = {
  kind: (v: unknown) => ADDON_KIND_LABEL[String(v)] ?? String(v),
  billing: (v: unknown) => ADDON_BILLING_LABEL[String(v)] ?? String(v),
  price: (v: unknown) => idr(Number(v)),
  is_active: (v: unknown) => (v ? "Active" : "Inactive"),
};

function parse(fd: FormData) {
  const name = str(fd, "name");
  const kind = str(fd, "kind");
  const billing = str(fd, "billing");
  const price = Math.round(Number(str(fd, "price") || 0));
  const fail = (error: string) => ({ ok: false as const, error });
  if (!name) return fail("Add-on name is required");
  if (name.length > 80) return fail("Add-on name is too long");
  if (!(kind in ADDON_KIND_LABEL)) return fail("Choose an add-on type");
  if (!(billing in ADDON_BILLING_LABEL)) return fail("Choose a billing period");
  if (!Number.isFinite(price) || price < 0) return fail("Price can't be negative");
  const description = str(fd, "description").slice(0, 500) || null;
  const sort = Math.max(0, Math.min(9999, Math.round(Number(str(fd, "sort") || 100))));
  return { ok: true as const, data: { name, kind, billing, price, description, sort: Number.isFinite(sort) ? sort : 100 } };
}

export async function createAddon(fd: FormData): Promise<ActionResult> {
  const user = await admin();
  const p = parse(fd);
  if (!p.ok) return { ok: false, message: p.error };
  try {
    const a = await prisma.addon.create({ data: p.data });
    await logActivity(prisma, { type: "addon", id: a.id, kind: "CREATED", authorId: user.id, label: a.name, body: `${ADDON_KIND_LABEL[a.kind]} · ${ADDON_BILLING_LABEL[a.billing]} · ${idr(Number(a.price))}` });
    revalidatePath("/products/addons");
    return { ok: true, changed: true, message: "Data saved", redirectTo: `/products/addons/${a.id}` };
  } catch {
    return { ok: false, message: "An add-on with this name already exists" };
  }
}

export async function saveAddon(fd: FormData): Promise<ActionResult> {
  const user = await admin();
  const id = str(fd, "id");
  const cur = await prisma.addon.findUnique({ where: { id } });
  if (!cur) return { ok: false, message: "Add-on not found" };
  const p = parse(fd);
  if (!p.ok) return { ok: false, message: p.error };
  const d = p.data;
  if (cur.name === d.name && cur.kind === d.kind && cur.billing === d.billing && Number(cur.price) === d.price && (cur.description ?? null) === d.description && cur.sort === d.sort) return { ok: true, changed: false, message: "No changes made" };
  try {
    await prisma.addon.update({ where: { id }, data: d });
    await logActivity(prisma, { type: "addon", id, kind: "UPDATED", authorId: user.id, label: d.name, changes: diffFields(LABELS, { ...cur, price: Number(cur.price) }, d, FMT) });
  } catch {
    return { ok: false, message: "An add-on with this name already exists" };
  }
  revalidatePath("/products/addons");
  revalidatePath(`/products/addons/${id}`);
  return { ok: true, changed: true, message: "Data saved" };
}

export async function bulkAddonActive(active: boolean, ids: string[]): Promise<ActionResult> {
  const user = await admin();
  const targets = await prisma.addon.findMany({ where: { id: { in: ids }, is_active: !active }, select: { id: true, name: true } });
  const { count } = await prisma.addon.updateMany({ where: { id: { in: ids }, is_active: !active }, data: { is_active: active } });
  for (const t of targets) await logActivity(prisma, { type: "addon", id: t.id, kind: "UPDATED", authorId: user.id, label: t.name, changes: [{ field: "Status", from: active ? "Inactive" : "Active", to: active ? "Active" : "Inactive" }] });
  revalidatePath("/products/addons");
  if (count === 0) return { ok: true, changed: false, message: "No changes made" };
  return { ok: true, changed: true, message: `${count} add-on(s) ${active ? "activated" : "deactivated"}` };
}

/** Add-on yang sudah dipakai lead tidak boleh dihapus (nonaktifkan saja). */
export async function deleteAddons(ids: string[]): Promise<ActionResult> {
  await admin();
  const used = await prisma.leadAddon.groupBy({ by: ["addon_id"], where: { addon_id: { in: ids } } });
  const blocked = new Set(used.map((u) => u.addon_id));
  const okIds = ids.filter((i) => !blocked.has(i));
  if (okIds.length) {
    await prisma.addon.deleteMany({ where: { id: { in: okIds } } });
    await purgeActivities("addon", okIds);
  }
  revalidatePath("/products/addons");
  if (okIds.length === 0) return { ok: false, message: "Can't delete: the add-on is already used by leads — set it to Inactive instead" };
  return { ok: true, changed: true, message: `${okIds.length} add-on(s) deleted${blocked.size ? ` · ${blocked.size} skipped (already used)` : ""}` };
}
