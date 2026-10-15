import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, addMonths } from "./format";
import { generateKey, type Env } from "./keys";
import type { RevealedKey } from "./flash";
import { logActivity } from "./activity";
import { checkPlans, createBillsForLead } from "./billing";
import type { PaymentPlan } from "./payment";

const TASK_TEMPLATE = [
  { title: "Environment Setup", days: 3 },
  { title: "Integrasi & Konfigurasi", days: 7 },
  { title: "UAT", days: 4 },
  { title: "Go-Live & Handover", days: 2 },
];

/**
 * Otomatisasi Closed Won (PRD §1): dalam 1 transaksi
 *  1. membuat Client baru,
 *  2. membuat Project + Task Board sesuai produk yang dibeli,
 *  3. meng-generate API Key per produk (hanya hash yang disimpan),
 *  4. membuat Bills sesuai sistem pembayaran yang dipilih user per produk.
 */
export async function closeLeadAsWon(leadId: string, userId: string, plans: Record<string, PaymentPlan>) {
  const lead = await prisma.lead.findUnique({ relationLoadStrategy: "join", where: { id: leadId }, include: { client: true, products: { include: { product: true } } } });
  if (!lead) throw new Error("Lead tidak ditemukan");
  if (lead.status === "CLOSED_WON") throw new Error("Lead sudah Closed Won");
  if (lead.status === "CLOSED_LOST") throw new Error("Lead yang sudah Closed Lost tidak bisa dibuka kembali");
  if (lead.status !== "NEGOTIATION") throw new Error("Closed Won hanya bisa dilakukan saat lead berada di tahap Negosiasi");
  if (lead.products.length === 0) throw new Error("Tambahkan minimal 1 produk ke lead sebelum Closed Won");

  checkPlans(lead.products, plans);

  const now = new Date();
  const revealed: RevealedKey[] = [];
  const licenseIds: string[] = [];

  const client = lead.client; // Client dipilih user pada lead (many2one), tidak lagi dibuat otomatis
  const clientId = await prisma.$transaction(async (tx) => {
    // 1. Project + Task Board
    const names = lead.products.map((lp) => lp.product.name);
    const maxMonths = Math.max(...lead.products.map((lp) => lp.license_months || 12));
    const project = await tx.project.create({
      data: {
        name: `Implementasi ${names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(" & ")} — ${client.name}`,
        client_id: client.id,
        lead_id: lead.id,
        product_id: lead.products.length === 1 ? lead.products[0].product_id : null,
        start_date: now,
        end_date: addMonths(now, maxMonths),
      },
    });

    // Task board: id dibuat di muka lalu dimasukkan sekaligus (createMany) — di serverless setiap query ke DB cloud memakan
    // waktu, dan puluhan query berurutan dalam satu transaksi bisa melewati batas waktunya.
    const tasks: Prisma.TaskCreateManyInput[] = [
      { id: randomUUID(), project_id: project.id, title: "Kickoff Meeting", status: "TODO", priority: "HIGH", start_date: now, due_date: addDays(now, 2), position: 0 },
    ];
    const kickoffId = tasks[0].id!;
    for (const lp of lead.products) {
      let prev = kickoffId;
      let cursor = addDays(now, 3);
      let pos = 1;
      for (const t of TASK_TEMPLATE) {
        const due = addDays(cursor, t.days - 1);
        const id = randomUUID();
        tasks.push({
          id, project_id: project.id, title: `[${lp.product.code}] ${t.title}`, status: "TODO", priority: t.title === "UAT" ? "HIGH" : "MEDIUM",
          start_date: cursor, due_date: due, depends_on_id: prev, position: pos++,
        });
        prev = id;
        cursor = addDays(due, 1);
      }
    }
    await tx.task.createMany({ data: tasks });
    await tx.activity.createMany({
      data: tasks.map((t) => ({ record_type: "task", record_id: t.id!, kind: "CREATED", body: "Created automatically from the project task template", record_label: t.title, author_id: userId })),
    });

    // 2. API Key / License per produk
    const keyRows: Prisma.ApiKeyCreateManyInput[] = [];
    for (const lp of lead.products) {
      const env = lp.environment as Env;
      const k = generateKey(env);
      const id = randomUUID();
      keyRows.push({
        id, client_id: client.id, project_id: project.id, product_id: lp.product_id, key_hash: k.hash, prefix: k.prefix, key_hint: k.hint, environment: env,
        rate_limit: lp.product.default_rate_limit, expires_at: lp.license_months > 0 ? addMonths(now, lp.license_months) : null,
      });
      revealed.push({ product: `${lp.product.code} — ${lp.product.name}`, environment: env, key: k.plain });
      licenseIds.push(id);
    }
    await tx.apiKey.createMany({ data: keyRows });
    await tx.activity.createMany({
      data: lead.products.map((lp, i) => ({
        record_type: "license", record_id: licenseIds[i], kind: "CREATED", author_id: userId, record_label: `${client.name} — ${lp.product.name}`,
        body: `Generated automatically when lead "${lead.title}" was closed as Won (${lp.environment})`,
      })),
    });

    // 3. Bills sesuai skema tagihan tiap produk
    const bills = await createBillsForLead(tx, { leadId: lead.id, leadTitle: lead.title, clientId: client.id, projectId: project.id, lines: lead.products, plans, licenseIds, start: now, authorId: userId });

    await tx.lead.update({ where: { id: lead.id }, data: { status: "CLOSED_WON", closed_at: now } });

    // Riwayat: lead, client, dan project hasil otomatisasi
    await logActivity(tx, { type: "lead", id: lead.id, kind: "EVENT", authorId: userId, label: lead.title, body: `Status changed to Closed Won — project, ${lead.products.length} API key(s) and ${bills} bill(s) were created automatically for ${client.name}` });
    await logActivity(tx, { type: "client", id: client.id, kind: "EVENT", authorId: userId, label: client.name, body: `Lead "${lead.title}" closed as Won — project and ${lead.products.length} license(s) created` });
    await logActivity(tx, { type: "project", id: project.id, kind: "CREATED", authorId: userId, label: project.name, body: `Created automatically with ${tasks.length} tasks when lead "${lead.title}" was closed as Won` });
    return client.id;
  }, { maxWait: 15000, timeout: 60000 }); // batas default Prisma (5 dtk) terlalu pendek untuk DB cloud

  return { clientId, revealed, licenseIds };
}
