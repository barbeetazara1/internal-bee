"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { closeLeadAsWon } from "@/lib/automation";
import { setKeyFlash } from "@/lib/flash";
import type { ActionResult } from "@/lib/result";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { checkPlans, createBillsForLead } from "@/lib/billing";
import type { PaymentPlan } from "@/lib/payment";
import { LEAD_FINAL, LICENSE_TYPES, PRIORITY_OPTIONS, canMoveLead, LEAD_LABEL, LEAD_STATUSES, leadDetailLocked, leadProductsLocked, licenseMonths } from "@/lib/constants";
import { fmtDateTime, idr } from "@/lib/format";
import { describeAddon, resolveAddons, type ResolvedAddon as ResolvedAddonLine } from "@/lib/lead-addons";
import { allSalesPersons, idsFrom, parseDuration } from "@/lib/sales";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
const priorityOf = (fd: FormData, fallback = "MEDIUM") => (PRIORITY_OPTIONS.some((o) => o.value === str(fd, "priority")) ? str(fd, "priority") : fallback);
const validPhone = (p: string | null) => !p || /^[0-9+()\-\s]+$/.test(p);


type ResolvedLine = { id?: string; product_id: string; quantity: number; price: number; license_months: number; environment: string };

/**
 * Baris produk dari form berisi produk, environment, harga, dan tipe lisensi (qty selalu 1).
 * Server memvalidasi: tipe lisensi dikenal dan harga tidak negatif.
 */
async function resolveLines(raw: string): Promise<{ ok: false; message: string } | { ok: true; lines: ResolvedLine[] }> {
  let arr: { id?: string; product_id: string; environment: string; price?: number; license_type?: string }[];
  try {
    arr = raw ? JSON.parse(raw) : [];
  } catch {
    return { ok: false, message: "Invalid product lines" };
  }
  const seen = new Set<string>();
  for (const r of arr) {
    if (!r.product_id) return { ok: false, message: "Choose a product for every product line" };
    if (seen.has(r.product_id)) return { ok: false, message: "A product can only be added once" };
    seen.add(r.product_id);
  }
  const products = await prisma.product.findMany({ where: { id: { in: arr.map((r) => r.product_id) } } });
  if (products.length !== arr.length) return { ok: false, message: "One of the selected products no longer exists" };
  for (const r of arr) {
    if (!(LICENSE_TYPES as readonly string[]).includes(String(r.license_type))) return { ok: false, message: "Choose a license type" };
    if (!Number.isFinite(Number(r.price)) || Number(r.price) < 0) return { ok: false, message: "Price can't be negative" };
  }
  const lines: ResolvedLine[] = arr.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    quantity: 1,
    price: Math.round(Number(r.price)),
    license_months: licenseMonths(String(r.license_type)),
    environment: r.environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION",
  }));
  return { ok: true, lines };
}

export async function createLead(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const client = await prisma.client.findUnique({ where: { id: str(fd, "client_id") } });
  if (!client) return { ok: false, message: "Choose a client (company) first" };
  if (!str(fd, "contact_name")) return { ok: false, message: "Contact name is required" };
  if (!str(fd, "phone")) return { ok: false, message: "Phone is required" };
  if (!validPhone(str(fd, "phone"))) return { ok: false, message: "Phone may only contain digits and + ( ) -" };
  const parsed = await resolveLines(str(fd, "lines"));
  if (!parsed.ok) return parsed;
  const addonsParsed = await resolveAddons(str(fd, "addons"), []); // lead baru belum punya produk tersimpan → add-on berlaku untuk semua produk
  if (!addonsParsed.ok) return addonsParsed;

  const sales = idsFrom(fd);
  if (!(await allSalesPersons(sales))) return { ok: false, message: "Choose valid sales persons" };

  // Activity yang dijadwalkan sejak form lead baru (ikut tersimpan bersama lead, tahap Baru)
  let drafts: { type_id: string; title?: string; scheduled_at: string; notes?: string; duration_minutes?: number; sales_ids?: string[]; location?: string }[] = [];
  try {
    drafts = str(fd, "activities") ? JSON.parse(str(fd, "activities")) : [];
  } catch {
    return { ok: false, message: "Invalid activities" };
  }
  const types = drafts.length ? await prisma.activityType.findMany({ where: { id: { in: drafts.map((d) => d.type_id) }, is_active: true } }) : [];
  for (const d of drafts) {
    if (!types.some((t) => t.id === d.type_id)) return { ok: false, message: "Choose an activity type" };
    if (!d.title?.trim()) return { ok: false, message: "Enter an activity title" };
    if (d.title.length > 120) return { ok: false, message: "Activity title is too long" };
    if (Number.isNaN(new Date(d.scheduled_at).getTime())) return { ok: false, message: "Choose the activity date and time" };
    if ((d.notes ?? "").length > 2000) return { ok: false, message: "Notes are too long" };
    const needsLoc = types.find((t) => t.id === d.type_id)!.needs_location;
    if (needsLoc && !d.location?.trim()) return { ok: false, message: "Enter the activity location" };
    if ((d.location ?? "").length > 200) return { ok: false, message: "Location is too long" };
    if (!parseDuration(d.duration_minutes)) return { ok: false, message: "Duration must be between 1 and 1440 minutes" };
    if ((d.sales_ids ?? []).some((sid) => !sales.includes(sid))) return { ok: false, message: "Sales person must be one of the lead's sales persons" };
  }

  const lead = await prisma.lead.create({
    data: {
      title: str(fd, "title") || `Peluang — ${client.name}`,
      client_id: client.id,
      contact_name: str(fd, "contact_name"),
      email: str(fd, "email") || null,
      phone: str(fd, "phone") || null,
      source: str(fd, "source") || null,
      notes: str(fd, "notes") || null,
      owner_id: user.id,
      priority: priorityOf(fd),
      sales_persons: { connect: sales.map((sid) => ({ id: sid })) },
      products: { create: parsed.lines.map(({ id: _id, ...l }) => l) },
      addons: { create: addonsParsed.lines.map(({ id: _id, ...l }) => l) },
      activities: { create: drafts.map((d) => ({ type_id: d.type_id, title: d.title!.trim(), stage: "NEW", scheduled_at: new Date(d.scheduled_at), duration_minutes: d.duration_minutes!, location: types.find((t) => t.id === d.type_id)!.needs_location ? d.location!.trim() : null, sales_persons: { connect: (d.sales_ids ?? []).map((sid) => ({ id: sid })) }, notes: d.notes?.trim() || null, created_by_id: user.id })) },
    },
  });
  await logActivity(prisma, { type: "lead", id: lead.id, kind: "CREATED", authorId: user.id, label: lead.title, body: `Client: ${client.name}${parsed.lines.length ? ` · ${parsed.lines.length} product(s) mapped` : ""}` });
  for (const d of drafts) {
    const t = types.find((x) => x.id === d.type_id)!;
    await logActivity(prisma, { type: "lead", id: lead.id, kind: "EVENT", authorId: user.id, label: lead.title, body: `Activity scheduled: ${t.name}: ${d.title!.trim()} (${fmtDateTime(new Date(d.scheduled_at))}) at ${LEAD_LABEL.NEW}` });
  }
  revalidatePath("/leads");
  revalidatePath("/activities");
  return { ok: true, changed: true, message: "Data saved", redirectTo: `/leads/${lead.id}` };
}

const describe = (price: number, m: number, env: string) => `${idr(price)} · ${m === 0 ? "one-time" : `${m} month${m > 1 ? "s" : ""}`} · ${env}`;

export async function updateLead(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const cur = await prisma.lead.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, products: { include: { product: true } }, addons: { include: { addon: true } }, sales_persons: { select: { id: true, name: true } } } });
  if (!cur) return { ok: false, message: "Lead not found" };
  // Detail lead terkunci setelah status lewat "Baru": field yang terkirim diabaikan, hanya baris produk yang boleh berubah.
  const detailLocked = leadDetailLocked(cur.status);
  let client = cur.client;
  let data = { title: cur.title, client_id: cur.client_id, contact_name: cur.contact_name, email: cur.email, phone: cur.phone, source: cur.source, notes: cur.notes };
  const changes: { field: string; from: string; to: string }[] = [];
  if (!detailLocked) {
    const picked = await prisma.client.findUnique({ where: { id: str(fd, "client_id") } });
    if (!picked) return { ok: false, message: "Choose a client (company) first" };
    if (!str(fd, "contact_name")) return { ok: false, message: "Contact name is required" };
    if (!str(fd, "phone")) return { ok: false, message: "Phone is required" };
    if (!validPhone(str(fd, "phone"))) return { ok: false, message: "Phone may only contain digits and + ( ) -" };
    client = picked;
    data = {
      title: str(fd, "title") || cur.title,
      client_id: picked.id,
      contact_name: str(fd, "contact_name"),
      email: str(fd, "email") || null,
      phone: str(fd, "phone") || null,
      source: str(fd, "source") || null,
      notes: str(fd, "notes") || null,
    };
    changes.push(...diffFields({ title: "Title", contact_name: "Contact", email: "Email", phone: "Phone", source: "Source", notes: "Notes" }, cur, data));
    if (cur.client_id !== picked.id) changes.unshift({ field: "Client", from: cur.client.name, to: picked.name });
  }

  // Prioritas: boleh diubah kapan saja selama lead belum ditutup (walau detail lain sudah terkunci).
  let priority = cur.priority;
  if (!(LEAD_FINAL as readonly string[]).includes(cur.status)) {
    priority = priorityOf(fd, cur.priority);
    if (priority !== cur.priority) changes.push({ field: "Priority", from: PRIORITY_LABEL[cur.priority] ?? cur.priority, to: PRIORITY_LABEL[priority] ?? priority });
  }

  // Sales Person (many2many): boleh diubah selama lead belum ditutup; activity yang memakai sales person yang dicabut ikut dilepas.
  let salesSet: string[] | null = null;
  if (!(LEAD_FINAL as readonly string[]).includes(cur.status) && fd.has("sales_person_marker")) {
    const ids = idsFrom(fd);
    if (!(await allSalesPersons(ids))) return { ok: false, message: "Choose valid sales persons" };
    if ([...cur.sales_persons.map((u) => u.id)].sort().join() !== [...ids].sort().join()) {
      salesSet = ids;
      const names = (list: string[]) => (list.length ? list.join(", ") : "—");
      const after = ids.length ? (await prisma.user.findMany({ where: { id: { in: ids } }, select: { name: true } })).map((u) => u.name) : [];
      changes.push({ field: "Sales Person", from: names(cur.sales_persons.map((u) => u.name)), to: names(after) });
    }
  }

  // Baris produk (dikirim bersama tombol Save). Lead Closed Won tidak boleh diubah produknya.
  type Op = { kind: "create" | "update" | "delete"; line?: { product_id: string; quantity: number; price: number; license_months: number; environment: string }; id?: string };
  const ops: Op[] = [];
  if (fd.has("lines") && !leadProductsLocked(cur.status)) {
    const resolved = await resolveLines(str(fd, "lines"));
    if (!resolved.ok) return resolved;
    const lines = resolved.lines;
    const products = await prisma.product.findMany({ where: { id: { in: lines.map((l) => l.product_id) } } });
    const name = (pid: string) => { const p = products.find((x) => x.id === pid) ?? cur.products.find((x) => x.product_id === pid)?.product; return p ? `${p.code} — ${p.name}` : pid; };
    const keep = new Set(lines.filter((l) => l.id).map((l) => l.id));
    for (const old of cur.products) {
      if (!keep.has(old.id)) {
        ops.push({ kind: "delete", id: old.id });
        changes.push({ field: `Product ${name(old.product_id)}`, from: describe(Number(old.price), old.license_months, old.environment), to: "removed" });
      }
    }
    for (const l of lines) {
      const old = cur.products.find((x) => x.id === l.id);
      if (!old) {
        ops.push({ kind: "create", line: l });
        changes.push({ field: `Product ${name(l.product_id)}`, from: "—", to: describe(l.price, l.license_months, l.environment) });
      } else if (old.product_id !== l.product_id || old.quantity !== l.quantity || Number(old.price) !== l.price || old.license_months !== l.license_months || old.environment !== l.environment) {
        ops.push({ kind: "update", id: old.id, line: l });
        changes.push({ field: `Product ${name(l.product_id)}`, from: describe(Number(old.price), old.license_months, old.environment), to: describe(l.price, l.license_months, l.environment) });
      }
    }
  }

  // Add-on (dikirim bersama tombol Save; terkunci bersama produk setelah lead ditutup)
  type AddonOp = { kind: "create" | "update" | "delete"; id?: string; line?: ResolvedAddonLine };
  const addonOps: AddonOp[] = [];
  if (fd.has("addons") && !leadProductsLocked(cur.status)) {
    const resolved = await resolveAddons(str(fd, "addons"), cur.products.map((p) => p.product_id));
    if (!resolved.ok) return resolved;
    const catalog = await prisma.addon.findMany({ where: { id: { in: resolved.lines.map((l) => l.addon_id) } } });
    const aname = (aid: string) => catalog.find((x) => x.id === aid)?.name ?? cur.addons.find((x) => x.addon_id === aid)?.addon.name ?? aid;
    const keep = new Set(resolved.lines.filter((l) => l.id).map((l) => l.id));
    const desc = (a: { price: unknown; quantity: number; billing: string; periods: number; client_managed: boolean }) => describeAddon({ price: Number(a.price), quantity: a.quantity, billing: a.billing, periods: a.periods, client_managed: a.client_managed });
    for (const old of cur.addons) {
      if (!keep.has(old.id)) {
        addonOps.push({ kind: "delete", id: old.id });
        changes.push({ field: `Add-on ${old.addon.name}`, from: desc(old), to: "removed" });
      }
    }
    for (const l of resolved.lines) {
      const old = cur.addons.find((x) => x.id === l.id);
      if (!old) {
        addonOps.push({ kind: "create", line: l });
        changes.push({ field: `Add-on ${aname(l.addon_id)}`, from: "—", to: desc(l) });
      } else if (old.addon_id !== l.addon_id || old.quantity !== l.quantity || Number(old.price) !== l.price || old.billing !== l.billing || old.periods !== l.periods || old.client_managed !== l.client_managed || (old.product_id ?? null) !== l.product_id) {
        addonOps.push({ kind: "update", id: old.id, line: l });
        changes.push({ field: `Add-on ${aname(l.addon_id)}`, from: desc(old), to: desc(l) });
      }
    }
  }

  if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: { ...data, priority, ...(salesSet ? { sales_persons: { set: salesSet.map((sid) => ({ id: sid })) } } : {}) } });
    if (salesSet) {
      for (const a of await tx.leadActivity.findMany({ where: { lead_id: id }, select: { id: true, sales_persons: { select: { id: true } } } })) {
        const drop = a.sales_persons.filter((u) => !salesSet!.includes(u.id));
        if (drop.length) await tx.leadActivity.update({ where: { id: a.id }, data: { sales_persons: { disconnect: drop.map((u) => ({ id: u.id })) } } });
      }
    }
    for (const op of ops) {
      if (op.kind === "delete") await tx.leadProduct.delete({ where: { id: op.id } });
      else if (op.kind === "update") await tx.leadProduct.update({ where: { id: op.id }, data: op.line! });
    }
    for (const op of ops) if (op.kind === "create") await tx.leadProduct.create({ data: { lead_id: id, ...op.line! } });
    for (const op of addonOps) {
      if (op.kind === "delete") await tx.leadAddon.delete({ where: { id: op.id } });
      else if (op.kind === "update") { const { id: _id, ...d } = op.line!; await tx.leadAddon.update({ where: { id: op.id }, data: d }); }
    }
    for (const op of addonOps) if (op.kind === "create") { const { id: _id, ...d } = op.line!; await tx.leadAddon.create({ data: { lead_id: id, ...d } }); }
    await logActivity(tx, { type: "lead", id, kind: "UPDATED", authorId: user.id, label: data.title, changes });
  }, { maxWait: 15000, timeout: 60000 });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return { ok: true, changed: true, message: "Data saved" };
}

export async function setLeadStatus(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const status = str(fd, "status");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.status === "CLOSED_WON") return;
  if (status === "CLOSED_WON") redirect(`/leads/${id}?error=` + encodeURIComponent("Gunakan tombol 'Closed Won' untuk menutup deal"));
  if (lead.status === status) return;
  if (!canMoveLead(lead.status, status)) redirect(`/leads/${id}?error=` + encodeURIComponent(`Status can only move forward — ${LEAD_LABEL[lead.status]} can't go back to ${LEAD_LABEL[status]}`));
  if (status !== "CLOSED_LOST" && (LEAD_STATUSES as readonly string[]).indexOf(status) >= 2 && (await prisma.leadProduct.count({ where: { lead_id: id } })) === 0) {
    redirect(`/leads/${id}?error=` + encodeURIComponent("Add at least one product (and Save) before moving to Qualified"));
  }
  // Pindah ke tahap berikutnya hanya boleh bila semua activity di tahap ini sudah selesai (Closed Lost dikecualikan: lead gagal tidak perlu menuntaskan sisa activity)
  if (status !== "CLOSED_LOST") {
    const open = await prisma.leadActivity.count({ where: { lead_id: id, stage: lead.status, status: { not: "DONE" } } });
    if (open > 0) redirect(`/leads/${id}?error=` + encodeURIComponent(`Selesaikan semua activity pada tahap ${LEAD_LABEL[lead.status]} terlebih dahulu (${open} belum selesai)`));
  }
  await prisma.lead.update({ where: { id }, data: { status, closed_at: status === "CLOSED_LOST" ? new Date() : null } });
  await logActivity(prisma, { type: "lead", id, kind: "EVENT", authorId: user.id, label: lead.title, body: `Status changed: ${LEAD_LABEL[lead.status]} → ${LEAD_LABEL[status]}` });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

/** Rencana pembayaran per baris produk dari modal Closed Won: JSON { [leadProductId]: PaymentPlan }. */
function parsePlans(fd: FormData): Record<string, PaymentPlan> {
  try {
    return JSON.parse(str(fd, "payment") || "{}");
  } catch {
    return {};
  }
}

/** Lead Closed Won yang belum punya bill (mis. ditutup sebelum fitur Bills): atur sistem pembayarannya setelahnya. */
export async function setLeadPayment(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  try {
    const lead = await prisma.lead.findUnique({ relationLoadStrategy: "join", where: { id }, include: { project: { include: { apiKeys: true } }, products: { include: { product: true } }, _count: { select: { bills: true } } } });
    if (!lead || lead.status !== "CLOSED_WON") throw new Error("Only a Closed Won lead can get a payment system");
    if (lead._count.bills > 0) throw new Error("This lead already has bills");
    const plans = parsePlans(fd);
    checkPlans(lead.products, plans);
    await prisma.$transaction((tx) =>
      createBillsForLead(tx, {
        leadId: lead.id, leadTitle: lead.title, clientId: lead.client_id, projectId: lead.project?.id ?? null, lines: lead.products, plans,
        licenseIds: lead.products.map((lp) => lead.project?.apiKeys.find((k) => k.product_id === lp.product_id)?.id ?? null), start: new Date(), authorId: user.id,
      }),
      { maxWait: 15000, timeout: 60000 },
    );
    await logActivity(prisma, { type: "lead", id, kind: "EVENT", authorId: user.id, label: lead.title, body: "Payment system set — bills were created" });
  } catch (e) {
    redirect(`/leads/${id}?error=` + encodeURIComponent((e as Error).message));
  }
  revalidatePath(`/leads/${id}`);
  revalidatePath("/bills");
  redirect("/bills");
}

export async function closeWon(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  let licenseId: string;
  let projectId: string | null;
  try {
    const res = await closeLeadAsWon(id, user.id, parsePlans(fd));
    await setKeyFlash(res.revealed);
    licenseId = res.licenseIds[0];
    projectId = res.projectId;
  } catch (e) {
    redirect(`/leads/${id}?error=` + encodeURIComponent((e as Error).message));
  }
  revalidatePath("/leads");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/licenses");
  // Langsung ke project hasil otomatisasi; semua API key baru tampil sekali di bagian atasnya.
  redirect(projectId ? `/projects/${projectId}?won=1` : `/licenses/${licenseId}?won=1`);
}

/** Lead hanya boleh dihapus selama statusnya "Baru". */
export async function bulkDeleteLeads(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN", "SALES");
  const found = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
  const okIds = found.filter((l) => l.status === "NEW").map((l) => l.id);
  const skipped = found.length - okIds.length;
  const actIds = (await prisma.leadActivity.findMany({ where: { lead_id: { in: okIds } }, select: { id: true } })).map((a) => a.id);
  await prisma.lead.deleteMany({ where: { id: { in: okIds } } });
  await purgeActivities("lead", okIds);
  await purgeActivities("activity", actIds);
  revalidatePath("/leads");
  if (okIds.length === 0) return { ok: false, message: `Can't delete: only leads with status "Baru" can be deleted` };
  return { ok: true, changed: true, message: `${okIds.length} lead(s) deleted${skipped ? ` · ${skipped} skipped (status is not "Baru")` : ""}` };
}
