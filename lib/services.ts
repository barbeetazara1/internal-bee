import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Db = Prisma.TransactionClient | typeof prisma;

export type ServiceState = "PENDING" | "ACTIVE" | "EXPIRING" | "AT_RISK" | "DOWN" | "ENDED" | "LIFETIME";
export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  PENDING: "Menunggu pembayaran pertama",
  ACTIVE: "Aktif",
  EXPIRING: "Segera berakhir",
  AT_RISK: "Berisiko down",
  DOWN: "Down (tidak diperpanjang)",
  ENDED: "Periode selesai",
  LIFETIME: "Sekali bayar",
};
export const SERVICE_STATE_TONE: Record<ServiceState, "green" | "amber" | "red" | "slate" | "blue"> = {
  PENDING: "slate", ACTIVE: "green", EXPIRING: "amber", AT_RISK: "red", DOWN: "red", ENDED: "slate", LIFETIME: "blue",
};
/** Urutan tampil: yang paling mendesak dulu. */
export const SERVICE_STATE_RANK: Record<ServiceState, number> = { DOWN: 0, AT_RISK: 1, EXPIRING: 2, PENDING: 3, ENDED: 4, ACTIVE: 5, LIFETIME: 6 };
export const EXPIRING_DAYS = 14; // masa aktif tinggal ≤ 14 hari → "segera berakhir"
export const DUE_SOON_DAYS = 7; // tagihan berikutnya jatuh tempo ≤ 7 hari

type Svc = { billing: string; periods: number; paid_periods: number; active_until: Date | null };
/** Status layanan dari masa aktif + tagihan terbuka paling awal (belum dibayar). */
export function serviceState(s: Svc, unpaidDue: Date | null, now = new Date()): ServiceState {
  const overdue = !!unpaidDue && unpaidDue.getTime() < now.getTime();
  if (s.billing === "ONE_TIME") return s.paid_periods > 0 ? "LIFETIME" : overdue ? "AT_RISK" : "PENDING";
  if (s.paid_periods === 0) return overdue ? "AT_RISK" : "PENDING";
  const until = s.active_until;
  if (until && until.getTime() <= now.getTime()) return s.paid_periods >= s.periods ? "ENDED" : "DOWN";
  if (overdue) return "AT_RISK";
  const day = 86400000;
  if ((unpaidDue && unpaidDue.getTime() - now.getTime() <= DUE_SOON_DAYS * day) || (until && until.getTime() - now.getTime() <= EXPIRING_DAYS * day)) return "EXPIRING";
  return "ACTIVE";
}

/** Menghitung ulang masa aktif layanan dari bill lunasnya (dipanggil setiap bill add-on lunas / dibuka kembali / dibatalkan). */
export async function refreshService(db: Db, serviceId: string | null | undefined) {
  if (!serviceId) return;
  const paid = await db.bill.findMany({ where: { service_id: serviceId, status: "PAID" }, select: { period_end: true } });
  const ends = paid.map((b) => b.period_end).filter((d): d is Date => !!d);
  const until = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  await db.service.update({ where: { id: serviceId }, data: { paid_periods: paid.length, active_until: until } });
}
