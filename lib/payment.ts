import { addMonths } from "./format";

/**
 * Sistem pembayaran yang dipilih user saat lead Closed Won, per baris produk.
 *  - FULL        : bayar penuh sekali (1 bill).
 *  - DP          : DP sebesar `dp_percent`% di hari closing, sisanya dicicil `installments` kali tiap `interval` bulan.
 *  - INSTALLMENT : total dicicil sama rata `installments` kali tiap `interval` bulan (cicilan pertama di hari closing).
 *  - MONTHLY     : bayar tiap bulan selama `months` bulan; harga di lead dianggap harga per bulan.
 */
export type PaymentPlan = (
  | { kind: "FULL" }
  | { kind: "DP"; dp_percent: number; installments: number; interval: number }
  | { kind: "INSTALLMENT"; installments: number; interval: number }
  | { kind: "MONTHLY"; months: number }
) & {
  /** Tanggal pembayaran pertama (YYYY-MM-DD) pilihan user; pembayaran berikutnya dihitung otomatis dari tanggal ini. Kosong = hari ini. */
  first_due?: string;
};

export type PaymentKind = PaymentPlan["kind"];

/** Sistem pembayaran yang tersedia untuk tiap tipe lisensi. Tahunan: bebas diatur user. */
export const PAYMENT_KINDS_FOR: Record<string, readonly PaymentKind[]> = {
  YEARLY: ["FULL", "DP", "INSTALLMENT"],
  ONE_TIME: ["FULL", "DP"],
  MONTHLY: ["MONTHLY"],
};
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = { FULL: "Bayar Penuh", DP: "DP + Cicilan", INSTALLMENT: "Cicilan Sama Rata", MONTHLY: "Per Bulan" };
/** Jenis tiap bill hasil jadwal. */
export const BILL_KIND_LABEL: Record<string, string> = { FULL: "Bayar Penuh", DP: "DP", INSTALLMENT: "Cicilan", MONTHLY: "Per Bulan", ADDON: "Add-on" };
export const INTERVALS = [1, 2, 3, 6, 12] as const;
export const MAX_PERIODS = 60;

export const defaultPlan = (licenseType: string): PaymentPlan =>
  licenseType === "MONTHLY" ? { kind: "MONTHLY", months: 12 } : { kind: "FULL" };

/** YYYY-MM-DD → Date pada tengah hari lokal (aman dari pergeseran zona waktu saat dikonversi ke tanggal). */
export function parseDay(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const int = (v: unknown) => (Number.isInteger(Number(v)) ? Number(v) : NaN);

/** Mengembalikan pesan error (Inggris, seperti pesan server lain) atau null bila rencana valid. */
export function validatePlan(plan: PaymentPlan, licenseType: string): string | null {
  if (!(PAYMENT_KINDS_FOR[licenseType] ?? []).includes(plan.kind)) return "Payment system doesn't match the license type";
  if (plan.first_due !== undefined && plan.first_due !== "") {
    if (!parseDay(plan.first_due)) return "First payment date is invalid";
    if (plan.first_due < todayStr()) return "First payment date can't be in the past";
  }
  if (plan.kind === "DP") {
    const p = int(plan.dp_percent);
    if (!(p >= 1 && p <= 99)) return "Down payment must be between 1% and 99%";
  }
  if (plan.kind === "DP" || plan.kind === "INSTALLMENT") {
    const n = int(plan.installments);
    if (!(n >= 1 && n <= MAX_PERIODS)) return `Installments must be between 1 and ${MAX_PERIODS}`;
    if (!(INTERVALS as readonly number[]).includes(Number(plan.interval))) return "Choose a valid installment interval";
  }
  if (plan.kind === "MONTHLY") {
    const m = int(plan.months);
    if (!(m >= 1 && m <= MAX_PERIODS)) return `Months must be between 1 and ${MAX_PERIODS}`;
  }
  return null;
}

export type ScheduleRow = { kind: Exclude<PaymentKind, never>; no: number; of: number; amount: number; due: Date; from: Date | null; to: Date | null };

/** Jadwal tagihan untuk `total` (rupiah). Jumlah semua baris = total (sisa pembulatan masuk baris terakhir); MONTHLY = harga × bulan. */
export function paymentSchedule(plan: PaymentPlan, total: number, now: Date): ScheduleRow[] {
  total = Math.round(total);
  const start = (plan.first_due && parseDay(plan.first_due)) || now; // pembayaran pertama = tanggal pilihan user, sisanya dihitung dari sini
  const split = (sum: number, n: number) => Array.from({ length: n }, (_, i) => (i === n - 1 ? sum - Math.floor(sum / n) * (n - 1) : Math.floor(sum / n)));
  if (plan.kind === "FULL") return [{ kind: "FULL", no: 1, of: 1, amount: total, due: start, from: null, to: null }];
  if (plan.kind === "MONTHLY") {
    return Array.from({ length: plan.months }, (_, i) => ({ kind: "MONTHLY" as const, no: i + 1, of: plan.months, amount: total, due: addMonths(start, i), from: addMonths(start, i), to: addMonths(start, i + 1) }));
  }
  if (plan.kind === "INSTALLMENT") {
    return split(total, plan.installments).map((amount, i) => ({ kind: "INSTALLMENT" as const, no: i + 1, of: plan.installments, amount, due: addMonths(start, i * plan.interval), from: null, to: null }));
  }
  const dp = Math.round((total * plan.dp_percent) / 100);
  const rest = split(total - dp, plan.installments);
  return [
    { kind: "DP", no: 1, of: plan.installments + 1, amount: dp, due: start, from: null, to: null },
    ...rest.map((amount, i) => ({ kind: "INSTALLMENT" as const, no: i + 2, of: plan.installments + 1, amount, due: addMonths(start, (i + 1) * plan.interval), from: null, to: null })),
  ];
}

/** Total yang ditagih untuk sebuah plan (MONTHLY: harga × bulan). */
export const planTotal = (plan: PaymentPlan, price: number) => (plan.kind === "MONTHLY" ? price * plan.months : price);
