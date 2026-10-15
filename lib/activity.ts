import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type RecordType = "product" | "lead" | "client" | "project" | "license" | "demo" | "task" | "bill";
export type Change = { field: string; from: string; to: string };
type Db = Prisma.TransactionClient | typeof prisma;

const BASE: Record<RecordType, string> = { product: "/products/", lead: "/leads/", client: "/clients/", project: "/projects/", license: "/licenses/", demo: "/demo/", task: "/tasks/", bill: "/bills/" };
export const recordLink = (type: RecordType, id: string) => BASE[type] + id;

/** Role yang boleh melihat/mengomentari tiap tipe record (untuk daftar @mention & otorisasi). */
export const ACCESS: Record<RecordType, string[]> = {
  product: ["SUPER_ADMIN", "SALES", "PROJECT"],
  lead: ["SUPER_ADMIN", "SALES"],
  client: ["SUPER_ADMIN", "SALES", "PROJECT"],
  project: ["SUPER_ADMIN", "SALES", "PROJECT"],
  license: ["SUPER_ADMIN", "SALES", "PROJECT"],
  demo: ["SUPER_ADMIN", "SALES", "PROJECT"],
  task: ["SUPER_ADMIN", "SALES", "PROJECT"],
  bill: ["SUPER_ADMIN", "SALES"],
};

/** Menghapus riwayat/komentar (dan notifikasinya) milik record yang dihapus. */
export async function purgeActivities(type: RecordType, ids: string[]) {
  if (ids.length) await prisma.activity.deleteMany({ where: { record_type: type, record_id: { in: ids } } });
}

export async function logActivity(
  db: Db,
  a: { type: RecordType; id: string; kind: "CREATED" | "UPDATED" | "EVENT" | "COMMENT"; authorId: string; body?: string; changes?: Change[]; label?: string },
) {
  return db.activity.create({
    data: {
      record_type: a.type,
      record_id: a.id,
      kind: a.kind,
      body: a.body ?? null,
      changes: a.changes && a.changes.length ? (a.changes as unknown as Prisma.InputJsonValue) : undefined,
      record_label: a.label ?? null,
      author_id: a.authorId,
    },
  });
}

const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
};

/** Membandingkan nilai lama & baru; hanya field yang berubah yang dikembalikan. */
export function diffFields(labels: Record<string, string>, before: Record<string, unknown>, after: Record<string, unknown>, fmt: Record<string, (v: unknown) => string> = {}): Change[] {
  const out: Change[] = [];
  for (const k of Object.keys(labels)) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (String(a ?? "") === String(b ?? "")) continue;
    const f = fmt[k] ?? show;
    out.push({ field: labels[k], from: f(a), to: f(b) });
  }
  return out;
}

/** Record lama yang belum punya riwayat diberi entri "Created" (sekali jalan, aman diulang). */
export async function backfillActivities() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { created_at: "asc" } });
  if (!admin) return;
  const has = async (type: RecordType) => new Set((await prisma.activity.findMany({ where: { record_type: type, kind: "CREATED" }, select: { record_id: true } })).map((x) => x.record_id));
  const mk = (type: RecordType, id: string, authorId: string, created_at: Date, label: string, body?: string) =>
    prisma.activity.create({ data: { record_type: type, record_id: id, kind: "CREATED", body: body ?? null, author_id: authorId, created_at, record_label: label } });

  const pHas = await has("product");
  for (const p of await prisma.product.findMany()) if (!pHas.has(p.id)) await mk("product", p.id, admin.id, p.created_at, p.name);
  const lHas = await has("lead");
  for (const l of await prisma.lead.findMany()) if (!lHas.has(l.id)) await mk("lead", l.id, l.owner_id, l.created_at, l.title);
  const cHas = await has("client");
  for (const c of await prisma.client.findMany({ relationLoadStrategy: "join", include: { leads: true } })) if (!cHas.has(c.id)) await mk("client", c.id, c.leads[0]?.owner_id ?? admin.id, c.created_at, c.name);
  const jHas = await has("project");
  for (const p of await prisma.project.findMany({ relationLoadStrategy: "join", include: { lead: true } })) if (!jHas.has(p.id)) await mk("project", p.id, p.lead?.owner_id ?? admin.id, p.created_at, p.name, p.lead ? `Created automatically when lead "${p.lead.title}" was closed as Won` : undefined);
  const kHas = await has("license");
  for (const k of await prisma.apiKey.findMany({ relationLoadStrategy: "join", include: { client: { include: { leads: true } }, product: true } })) {
    if (!kHas.has(k.id)) await mk("license", k.id, k.client.leads[0]?.owner_id ?? admin.id, k.created_at, `${k.client.name} — ${k.product.name}`, "Generated automatically when the lead was closed as Won");
  }
  const tHas = await has("task");
  for (const t of await prisma.task.findMany({ relationLoadStrategy: "join", include: { project: { include: { lead: true } } } })) {
    if (!tHas.has(t.id)) await mk("task", t.id, t.project.lead?.owner_id ?? admin.id, t.created_at, t.title, t.project.lead ? "Created automatically from the project task template" : undefined);
  }
}
