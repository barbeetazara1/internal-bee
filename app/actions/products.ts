"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/lib/result";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { idr } from "@/lib/format";
import { LICENSE_LABEL, LICENSE_TYPES } from "@/lib/constants";

export async function saveProduct(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN");
  const id = String(fd.get("id") ?? "");
  const data = {
    name: String(fd.get("name") ?? "").trim(),
    code: String(fd.get("code") ?? "").trim().toUpperCase(),
    license_type: String(fd.get("license_type") ?? "YEARLY"),
    base_price: Math.max(0, Number(fd.get("base_price") ?? 0)),
    description: String(fd.get("description") ?? "").trim() || null,
  };
  if (!data.name || !data.code) return { ok: false, message: "Product name and code are required" };
  if (!(LICENSE_TYPES as readonly string[]).includes(data.license_type)) return { ok: false, message: "Choose a license type" };
  try {
    if (id) {
      const cur = await prisma.product.findUnique({ where: { id } });
      if (!cur) return { ok: false, message: "Product not found" };
      const changed =
        cur.name !== data.name || cur.code !== data.code || cur.license_type !== data.license_type ||
        Number(cur.base_price) !== data.base_price || (cur.description ?? null) !== data.description;
      if (!changed) return { ok: true, changed: false, message: "No changes made" };
      await prisma.product.update({ where: { id }, data });
      await logActivity(prisma, {
        type: "product", id, kind: "UPDATED", authorId: user.id, label: data.name,
        changes: diffFields(
          { name: "Name", code: "Code", license_type: "License type", base_price: "Base price", description: "Description" },
          cur, data, { base_price: (v) => idr(Number(v ?? 0)), license_type: (v) => LICENSE_LABEL[String(v)] ?? String(v) },
        ),
      });
      revalidatePath("/products");
      revalidatePath(`/products/${id}`);
      return { ok: true, changed: true, message: "Data saved" };
    }
    const p = await prisma.product.create({ data });
    await logActivity(prisma, { type: "product", id: p.id, kind: "CREATED", authorId: user.id, label: p.name });
    revalidatePath("/products");
    return { ok: true, changed: true, message: "Data saved", redirectTo: `/products/${p.id}` };
  } catch {
    return { ok: false, message: "Product code is already in use" };
  }
}

export async function setProductsActive(active: boolean, ids: string[]): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN");
  const changing = await prisma.product.findMany({ where: { id: { in: ids }, is_active: !active }, select: { id: true, name: true } });
  await prisma.product.updateMany({ where: { id: { in: changing.map((p) => p.id) } }, data: { is_active: active } });
  for (const p of changing) {
    await logActivity(prisma, { type: "product", id: p.id, kind: "UPDATED", authorId: user.id, label: p.name, changes: [{ field: "Status", from: active ? "Inactive" : "Active", to: active ? "Active" : "Inactive" }] });
  }
  revalidatePath("/products");
  const skipped = ids.length - changing.length;
  if (changing.length === 0) return { ok: true, changed: false, message: `No changes made — already ${active ? "active" : "inactive"}` };
  return { ok: true, changed: true, message: `${changing.length} product(s) ${active ? "activated" : "deactivated"}${skipped ? ` · ${skipped} unchanged` : ""}` };
}

/** Produk yang sudah dipakai lead / lisensi / project tidak boleh dihapus (nonaktifkan saja). */
export async function deleteProducts(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  const used = await prisma.product.findMany({
    where: { id: { in: ids }, OR: [{ leadProducts: { some: {} } }, { apiKeys: { some: {} } }, { projects: { some: {} } }] },
    select: { id: true, name: true },
  });
  const blocked = new Set(used.map((p) => p.id));
  const okIds = ids.filter((i) => !blocked.has(i));
  await prisma.product.deleteMany({ where: { id: { in: okIds } } });
  await purgeActivities("product", okIds);
  revalidatePath("/products");
  if (okIds.length === 0) return { ok: false, message: "Product is already used by leads, licenses or projects — set it to Inactive instead" };
  return { ok: true, changed: true, message: `${okIds.length} product(s) deleted${blocked.size ? ` · ${blocked.size} skipped (still in use)` : ""}` };
}
