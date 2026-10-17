import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { logActivity } from "./activity";
import { paymentSchedule, validatePlan, type PaymentPlan } from "./payment";
import { licenseTypeOf } from "./constants";
import { addonSchedule } from "./addons";

type Tx = Prisma.TransactionClient;

/** Satu baris jadwal pada rencana tagihan berjenjang (tanggal disimpan sebagai ISO string di kolom JSON). */
export type PlanRow = { no: number; of: number; kind: string; amount: number; due: string; from: string | null; to: string | null };
type SchedRow = { kind: string; no: number; of: number; amount: number; due: Date; from: Date | null; to: Date | null };
const toPlan = (rows: SchedRow[]): PlanRow[] => rows.map((r) => ({ no: r.no, of: r.of, kind: r.kind, amount: r.amount, due: r.due.toISOString(), from: r.from ? r.from.toISOString() : null, to: r.to ? r.to.toISOString() : null }));

/** Kode berurutan BILL-0001, BILL-0002, … (melanjutkan dari kode terbesar yang ada). */
async function nextCodes(tx: Tx, n: number) {
  const last = await tx.bill.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const base = last ? Number(last.code.replace(/\D/g, "")) || 0 : 0;
  return Array.from({ length: n }, (_, i) => `BILL-${String(base + i + 1).padStart(4, "0")}`);
}

type Line = { id: string; product_id: string; price: unknown; license_months: number; product: { code: string } };

/** Memastikan tiap baris produk punya rencana pembayaran yang valid. Melempar Error berisi pesan bila tidak. */
export function checkPlans(lines: Line[], plans: Record<string, PaymentPlan> | undefined) {
  for (const l of lines) {
    const p = plans?.[l.id];
    if (!p) throw new Error(`Choose a payment system for ${l.product.code}`);
    const err = validatePlan(p, licenseTypeOf(l.license_months));
    if (err) throw new Error(`${l.product.code}: ${err}`);
  }
}

/** Membuat semua bill untuk lead Closed Won sesuai rencana pembayaran per baris. `licenseIds` sejajar dengan `lines`. Mengembalikan jumlah bill. */
export async function createBillsForLead(
  tx: Tx,
  a: { leadId: string; leadTitle: string; clientId: string; projectId: string | null; lines: Line[]; plans: Record<string, PaymentPlan>; licenseIds: (string | null)[]; start: Date; authorId: string },
) {
  // Hanya bill pertama tiap baris yang dibuat sekarang; bill berikutnya dibuat satu per satu setelah bill sebelumnya dibayar (createNextBill).
  const rows = a.lines.map((l, i) => {
    const sched = paymentSchedule(a.plans[l.id], Number(l.price), a.start);
    return { l, license: a.licenseIds[i] ?? null, s: sched[0], plan: toPlan(sched), key: randomUUID() };
  });
  const codes = await nextCodes(tx, rows.length);
  // Dimasukkan sekaligus (createMany) agar tidak puluhan query berurutan dalam satu transaksi.
  const ids = rows.map(() => randomUUID());
  await tx.bill.createMany({
    data: rows.map(({ l, license, s, plan, key }, i) => ({
      id: ids[i], code: codes[i], client_id: a.clientId, lead_id: a.leadId, project_id: a.projectId, api_key_id: license, product_id: l.product_id,
      plan_key: plan.length > 1 ? key : null, plan: plan.length > 1 ? (plan as unknown as Prisma.InputJsonValue) : undefined,
      kind: s.kind, period_no: s.no, period_total: s.of, period_start: s.from, period_end: s.to, amount: s.amount, due_date: s.due,
    })),
  });
  await tx.activity.createMany({
    data: rows.map(({ l, s }, i) => ({
      record_type: "bill", record_id: ids[i], kind: "CREATED", author_id: a.authorId, record_label: codes[i],
      body: `Generated automatically when lead "${a.leadTitle}" was closed as Won (${l.product.code}, ${s.kind === "DP" ? "down payment" : s.kind === "FULL" ? "full payment" : `payment ${s.no}/${s.of}`})`,
    })),
  });
  return rows.length;
}

type AddonLine = { quantity: number; price: unknown; billing: string; periods: number; client_managed: boolean; product_id: string | null; addon: { name: string; kind: string } };

/**
 * Bill untuk add-on lead (hosting, domain, …) saat Closed Won: satu bill per periode (bulanan/tahunan) atau satu bill (one-time).
 * Add-on "dikelola client" dilewati. Bill dikaitkan ke produk yang dituju add-on (atau produk pertama bila berlaku untuk semua).
 */
export async function createAddonBillsForLead(
  tx: Tx,
  a: { leadId: string; leadTitle: string; clientId: string; projectId: string | null; productIds: string[]; addons: AddonLine[]; start: Date; authorId: string },
) {
  // Seperti bill produk: hanya periode pertama yang dibuat sekarang, periode berikutnya menyusul setelah yang sebelumnya dibayar.
  const rows = a.addons
    .filter((x) => !x.client_managed)
    .map((x) => {
      const sched = addonSchedule(x.billing, x.periods, Number(x.price) * x.quantity, a.start).map((r) => ({ ...r, kind: "ADDON" }));
      return { x, s: sched[0], plan: toPlan(sched), key: randomUUID(), product_id: x.product_id && a.productIds.includes(x.product_id) ? x.product_id : a.productIds[0] };
    });
  if (rows.length === 0) return 0;
  const codes = await nextCodes(tx, rows.length);
  const ids = rows.map(() => randomUUID());
  // Setiap add-on berbayar menjadi satu "layanan" yang masa aktifnya dilacak (menu Services)
  const serviceIds = rows.map(() => randomUUID());
  await tx.service.createMany({
    data: rows.map(({ x, product_id }, i) => ({
      id: serviceIds[i], client_id: a.clientId, lead_id: a.leadId, project_id: a.projectId, product_id, name: x.addon.name, kind: x.addon.kind, billing: x.billing,
      periods: x.billing === "ONE_TIME" ? 1 : x.periods, amount: Number(x.price) * x.quantity,
    })),
  });
  await tx.bill.createMany({
    data: rows.map(({ x, s, product_id, plan, key }, i) => ({
      id: ids[i], code: codes[i], client_id: a.clientId, lead_id: a.leadId, project_id: a.projectId, product_id, addon_name: x.addon.name, service_id: serviceIds[i],
      plan_key: plan.length > 1 ? key : null, plan: plan.length > 1 ? (plan as unknown as Prisma.InputJsonValue) : undefined,
      kind: "ADDON", period_no: s.no, period_total: s.of, period_start: s.from, period_end: s.to, amount: s.amount, due_date: s.due,
    })),
  });
  await tx.activity.createMany({
    data: rows.map(({ x, s }, i) => ({
      record_type: "bill", record_id: ids[i], kind: "CREATED", author_id: a.authorId, record_label: codes[i],
      body: `Generated automatically when lead "${a.leadTitle}" was closed as Won (add-on ${x.addon.name}, ${s.of > 1 ? `period ${s.no}/${s.of}` : "one-time"})`,
    })),
  });
  return rows.length;
}

/**
 * Setelah sebuah bill lunas: membuat bill periode berikutnya dari rencana yang tersimpan (satu per satu, bukan sekaligus).
 * Tanggal jatuh tempo mengikuti jadwal rencana (bukan tanggal bayar). Aman dipanggil ulang: tidak membuat duplikat.
 * Mengembalikan bill baru, atau null bila tidak ada periode lagi / bill tidak punya rencana (bill lama).
 */
export async function createNextBill(tx: Tx, billId: string, authorId: string) {
  const b = await tx.bill.findUnique({ where: { id: billId } });
  if (!b || !b.plan_key || !Array.isArray(b.plan)) return null;
  const rows = b.plan as unknown as PlanRow[];
  const next = rows.find((r) => r.no === b.period_no + 1);
  if (!next) return null;
  if (await tx.bill.count({ where: { plan_key: b.plan_key, period_no: next.no } })) return null;
  const [code] = await nextCodes(tx, 1);
  const created = await tx.bill.create({
    data: {
      code, client_id: b.client_id, lead_id: b.lead_id, project_id: b.project_id, api_key_id: b.api_key_id, product_id: b.product_id, addon_name: b.addon_name, service_id: b.service_id,
      plan_key: b.plan_key, plan: b.plan as Prisma.InputJsonValue, kind: next.kind, period_no: next.no, period_total: next.of,
      period_start: next.from ? new Date(next.from) : null, period_end: next.to ? new Date(next.to) : null, amount: next.amount, due_date: new Date(next.due),
    },
  });
  await logActivity(tx, { type: "bill", id: created.id, kind: "CREATED", authorId, label: code, body: `Generated automatically after ${b.code} was paid (payment ${next.no}/${next.of})` });
  await logActivity(tx, { type: "bill", id: b.id, kind: "EVENT", authorId, label: b.code, body: `Next bill created: ${code} (payment ${next.no}/${next.of})` });
  return created;
}
