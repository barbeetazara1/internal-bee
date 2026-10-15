import type { Prisma } from "@prisma/client";
import { logActivity } from "./activity";
import { paymentSchedule, validatePlan, type PaymentPlan } from "./payment";
import { licenseTypeOf } from "./constants";

type Tx = Prisma.TransactionClient;

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
  const rows = a.lines.flatMap((l, i) => paymentSchedule(a.plans[l.id], Number(l.price), a.start).map((s) => ({ l, license: a.licenseIds[i] ?? null, s })));
  const codes = await nextCodes(tx, rows.length);
  for (const [i, { l, license, s }] of rows.entries()) {
    const bill = await tx.bill.create({
      data: {
        code: codes[i], client_id: a.clientId, lead_id: a.leadId, project_id: a.projectId, api_key_id: license, product_id: l.product_id,
        kind: s.kind, period_no: s.no, period_total: s.of, period_start: s.from, period_end: s.to, amount: s.amount, due_date: s.due,
      },
    });
    await logActivity(tx, {
      type: "bill", id: bill.id, kind: "CREATED", authorId: a.authorId, label: bill.code,
      body: `Generated automatically when lead "${a.leadTitle}" was closed as Won (${l.product.code}, ${s.kind === "DP" ? "down payment" : s.kind === "FULL" ? "full payment" : `payment ${s.no}/${s.of}`})`,
    });
  }
  return rows.length;
}
