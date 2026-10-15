"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { generateKey } from "@/lib/keys";
import { setKeyFlash } from "@/lib/flash";
import { addDays } from "@/lib/format";
import { DEFAULT_DEMO_DAYS } from "@/lib/constants";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const ROLES = ["SUPER_ADMIN", "SALES"] as const;
const validPhone = (p: string | null) => !p || /^[0-9+()\-\s]+$/.test(p);

export async function saveDemo(fd: FormData): Promise<ActionResult> {
  const user = await requireRole(...ROLES);
  const id = str(fd, "id");
  const client = await prisma.client.findUnique({ where: { id: str(fd, "client_id") } });
  if (!client) return { ok: false, message: "Choose a client first" };
  const product = await prisma.product.findUnique({ where: { id: str(fd, "product_id") } });
  if (!product) return { ok: false, message: "Choose the product to be demoed" };
  if (!str(fd, "contact_name")) return { ok: false, message: "Contact name is required" };
  if (!validPhone(str(fd, "phone"))) return { ok: false, message: "Phone may only contain digits and + ( ) -" };
  const days = Number(str(fd, "demo_days") || DEFAULT_DEMO_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 90) return { ok: false, message: "Demo length must be between 1 and 90 days" };

  const data = {
    client_id: client.id,
    product_id: product.id,
    contact_name: str(fd, "contact_name"),
    email: str(fd, "email") || null,
    phone: str(fd, "phone") || null,
    demo_days: days,
    notes: str(fd, "notes") || null,
  };

  if (id) {
    const cur = await prisma.demo.findUnique({ where: { id }, include: { client: true, product: true } });
    if (!cur) return { ok: false, message: "Demo not found" };
    if (cur.status !== "REQUESTED") return { ok: false, message: "Only demo requests that haven't started can be edited" };
    const changes = diffFields({ contact_name: "Contact", email: "Email", phone: "Phone", demo_days: "Demo length (days)", notes: "Notes" }, cur, data);
    if (cur.client_id !== client.id) changes.unshift({ field: "Client", from: cur.client.name, to: client.name });
    if (cur.product_id !== product.id) changes.unshift({ field: "Product", from: cur.product.name, to: product.name });
    if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };
    await prisma.demo.update({ where: { id }, data });
    await logActivity(prisma, { type: "demo", id, kind: "UPDATED", authorId: user.id, label: `${cur.code} — ${client.name}`, changes });
    revalidatePath("/demo");
    revalidatePath(`/demo/${id}`);
    return { ok: true, changed: true, message: "Data saved" };
  }

  const all = await prisma.demo.findMany({ select: { code: true } });
  const next = all.reduce((m, d) => Math.max(m, parseInt(d.code.replace(/\D/g, "")) || 0), 0) + 1;
  const d = await prisma.demo.create({ data: { ...data, code: `DEMO-${String(next).padStart(4, "0")}`, owner_id: user.id } });
  await logActivity(prisma, { type: "demo", id: d.id, kind: "CREATED", authorId: user.id, label: `${d.code} — ${client.name}`, body: `Demo of ${product.name} requested by ${client.name} (${days} days)` });
  revalidatePath("/demo");
  return { ok: true, changed: true, message: "Data saved", redirectTo: `/demo/${d.id}` };
}

/** Memulai demo: membuat license key demo (sandbox) yang berlaku selama lama demo. */
export async function startDemo(fd: FormData) {
  const user = await requireRole(...ROLES);
  const id = str(fd, "id");
  const demo = await prisma.demo.findUnique({ where: { id }, include: { client: true, product: true } });
  if (!demo) redirect("/demo");
  if (demo.status !== "REQUESTED") redirect(`/demo/${id}?error=` + encodeURIComponent("This demo has already been started or closed"));

  const now = new Date();
  const ends = addDays(now, demo.demo_days);
  const k = generateKey("SANDBOX");
  const key = await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        client_id: demo.client_id,
        product_id: demo.product_id,
        demo_id: demo.id,
        kind: "DEMO",
        key_hash: k.hash,
        prefix: k.prefix,
        key_hint: k.hint,
        environment: "SANDBOX",
        rate_limit: demo.product.default_rate_limit,
        expires_at: ends,
      },
    });
    await tx.demo.update({ where: { id }, data: { status: "ACTIVE", started_at: now, ends_at: ends } });
    await logActivity(tx, { type: "demo", id, kind: "EVENT", authorId: user.id, label: `${demo.code} — ${demo.client.name}`, body: `Demo started — demo license key generated, valid until ${ends.toISOString().slice(0, 10)}` });
    await logActivity(tx, { type: "license", id: created.id, kind: "CREATED", authorId: user.id, label: `${demo.client.name} — ${demo.product.name} (Demo)`, body: `Demo license generated from ${demo.code} (SANDBOX, ${demo.demo_days} days)` });
    return created;
  });
  await setKeyFlash([{ product: `${demo.product.code} — ${demo.product.name} (Demo)`, environment: "SANDBOX", key: k.plain }]);
  revalidatePath("/demo");
  revalidatePath(`/demo/${id}`);
  revalidatePath("/licenses/demo");
  redirect(`/demo/${id}?started=${key.id}`);
}

export async function endDemo(fd: FormData) {
  const user = await requireRole(...ROLES);
  const id = str(fd, "id");
  const demo = await prisma.demo.findUnique({ where: { id }, include: { client: true } });
  if (!demo || demo.status !== "ACTIVE") redirect(`/demo/${id}`);
  await prisma.$transaction(async (tx) => {
    await tx.apiKey.updateMany({ where: { demo_id: id, status: { not: "REVOKED" } }, data: { status: "REVOKED", revoked_at: new Date() } });
    await tx.demo.update({ where: { id }, data: { status: "ENDED" } });
    await logActivity(tx, { type: "demo", id, kind: "EVENT", authorId: user.id, label: `${demo.code} — ${demo.client.name}`, body: "Demo ended — demo license key revoked" });
  });
  revalidatePath("/demo");
  revalidatePath(`/demo/${id}`);
  revalidatePath("/licenses/demo");
  redirect(`/demo/${id}`);
}

export async function cancelDemo(fd: FormData) {
  const user = await requireRole(...ROLES);
  const id = str(fd, "id");
  const demo = await prisma.demo.findUnique({ where: { id }, include: { client: true } });
  if (!demo || demo.status !== "REQUESTED") redirect(`/demo/${id}`);
  await prisma.demo.update({ where: { id }, data: { status: "CANCELLED" } });
  await logActivity(prisma, { type: "demo", id, kind: "EVENT", authorId: user.id, label: `${demo.code} — ${demo.client.name}`, body: "Demo request cancelled" });
  revalidatePath("/demo");
  revalidatePath(`/demo/${id}`);
  redirect(`/demo/${id}`);
}

/** Demo yang sedang berjalan harus diakhiri dulu sebelum dihapus. */
export async function deleteDemos(ids: string[]): Promise<ActionResult> {
  await requireRole(...ROLES);
  const found = await prisma.demo.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
  const okIds = found.filter((d) => d.status !== "ACTIVE").map((d) => d.id);
  const skipped = found.length - okIds.length;
  const keys = await prisma.apiKey.findMany({ where: { demo_id: { in: okIds } }, select: { id: true } });
  await prisma.apiKey.deleteMany({ where: { demo_id: { in: okIds } } });
  await purgeActivities("license", keys.map((k) => k.id));
  await prisma.demo.deleteMany({ where: { id: { in: okIds } } });
  await purgeActivities("demo", okIds);
  revalidatePath("/demo");
  revalidatePath("/licenses/demo");
  if (okIds.length === 0) return { ok: false, message: "Can't delete a running demo — end it first" };
  return { ok: true, changed: true, message: `${okIds.length} demo(s) deleted${skipped ? ` · ${skipped} skipped (still running)` : ""}` };
}
