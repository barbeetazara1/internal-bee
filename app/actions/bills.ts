"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, requireRole } from "@/lib/auth";
import type { ActionResult } from "@/lib/result";
import { diffFields, logActivity, purgeActivities } from "@/lib/activity";
import { BILL_LABEL } from "@/lib/constants";
import { fmtDate, idr } from "@/lib/format";
import { removeProof } from "@/lib/proof";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Ubah jatuh tempo, jumlah, dan catatan. Hanya untuk bill yang belum dibayar. */
export async function saveBill(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const cur = await prisma.bill.findUnique({ where: { id } });
  if (!cur) return { ok: false, message: "Bill not found" };
  if (cur.status !== "UNPAID") return { ok: false, message: "Only unpaid bills can be edited" };
  const due = new Date(str(fd, "due_date"));
  const amount = Math.round(Number(str(fd, "amount") || 0));
  if (Number.isNaN(due.getTime())) return { ok: false, message: "Due date is required" };
  if (!(amount > 0)) return { ok: false, message: "Amount must be greater than zero" };
  const data = { due_date: due, amount, notes: str(fd, "notes") || null };
  const changes = diffFields(
    { due_date: "Due date", amount: "Amount", notes: "Notes" },
    { due_date: cur.due_date.toISOString().slice(0, 10), amount: Number(cur.amount), notes: cur.notes },
    { due_date: due.toISOString().slice(0, 10), amount, notes: data.notes },
    { due_date: (v) => fmtDate(String(v)), amount: (v) => idr(Number(v ?? 0)) },
  );
  if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };
  await prisma.bill.update({ where: { id }, data });
  await logActivity(prisma, { type: "bill", id, kind: "UPDATED", authorId: user.id, label: cur.code, changes });
  revalidatePath(`/bills/${id}`);
  revalidatePath("/bills");
  return { ok: true, changed: true, message: "Data saved" };
}

const NEXT: Record<string, string[]> = { UNPAID: ["PAID", "CANCELLED"], PAID: ["UNPAID"], CANCELLED: ["UNPAID"] };

/** Tandai lunas / batalkan / buka kembali (kembali ke belum dibayar). */
export async function changeBillStatus(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  const id = str(fd, "id");
  const status = str(fd, "status");
  const cur = await prisma.bill.findUnique({ where: { id } });
  if (!cur || status === "PAID" || !(NEXT[cur.status] ?? []).includes(status)) return; // lunas hanya lewat unggah bukti (/api/bills/[id]/proof)
  await prisma.bill.update({ where: { id }, data: { status, paid_at: null, proof_file: null, proof_name: null, proof_type: null, proof_size: null } });
  await removeProof(cur.proof_file);
  await logActivity(prisma, { type: "bill", id, kind: "EVENT", authorId: user.id, label: cur.code, body: `Status changed: ${BILL_LABEL[cur.status]} → ${BILL_LABEL[status]}` });
  revalidatePath(`/bills/${id}`);
  revalidatePath("/bills");
}

export async function deleteBills(ids: string[]): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "SALES");
  if (!can.admin(user.role)) return { ok: false, message: "Only Super Admin can delete bills" };
  const withProof = await prisma.bill.findMany({ where: { id: { in: ids }, proof_file: { not: null } }, select: { proof_file: true } });
  const { count } = await prisma.bill.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(withProof.map((b) => removeProof(b.proof_file)));
  await purgeActivities("bill", ids);
  revalidatePath("/bills");
  return { ok: true, changed: true, message: `${count} bill(s) deleted` };
}
