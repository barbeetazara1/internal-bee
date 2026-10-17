import { addMonths } from "./format";

export const ADDON_KIND_OPTIONS = [
  { value: "HOSTING", label: "Hosting / Server" },
  { value: "DOMAIN", label: "Domain" },
  { value: "SSL", label: "SSL" },
  { value: "MAINTENANCE", label: "Maintenance / Support" },
  { value: "OTHER", label: "Lainnya" },
];
export const ADDON_KIND_LABEL: Record<string, string> = Object.fromEntries(ADDON_KIND_OPTIONS.map((o) => [o.value, o.label]));

export const ADDON_BILLING_OPTIONS = [
  { value: "MONTHLY", label: "Bulanan" },
  { value: "YEARLY", label: "Tahunan" },
  { value: "ONE_TIME", label: "One-time" },
];
export const ADDON_BILLING_LABEL: Record<string, string> = Object.fromEntries(ADDON_BILLING_OPTIONS.map((o) => [o.value, o.label]));
/** Satuan periode untuk tampilan: "12 bulan", "2 tahun". */
export const ADDON_PERIOD_UNIT: Record<string, string> = { MONTHLY: "bulan", YEARLY: "tahun", ONE_TIME: "" };
export const ADDON_DEFAULT_PERIODS: Record<string, number> = { MONTHLY: 12, YEARLY: 1, ONE_TIME: 1 };
export const ADDON_MAX_PERIODS = 60;

export type AddonScheduleRow = { no: number; of: number; amount: number; due: Date; from: Date | null; to: Date | null };

/** Jadwal tagihan add-on: bulanan/tahunan = satu bill per periode (harga × jumlah), one-time = satu bill. Periode pertama jatuh tempo pada `start`. */
export function addonSchedule(billing: string, periods: number, unitTotal: number, start: Date): AddonScheduleRow[] {
  const amount = Math.round(unitTotal);
  if (billing === "ONE_TIME") return [{ no: 1, of: 1, amount, due: start, from: null, to: null }];
  const step = billing === "YEARLY" ? 12 : 1;
  const n = Math.max(1, Math.min(ADDON_MAX_PERIODS, periods));
  return Array.from({ length: n }, (_, i) => ({ no: i + 1, of: n, amount, due: addMonths(start, i * step), from: addMonths(start, i * step), to: addMonths(start, (i + 1) * step) }));
}

/** Total tagihan satu add-on lead (harga × qty × periode); add-on yang dikelola client tidak ditagih = 0. */
export const addonTotal = (a: { price: unknown; quantity: number; billing: string; periods: number; client_managed: boolean }) =>
  a.client_managed ? 0 : Number(a.price) * a.quantity * (a.billing === "ONE_TIME" ? 1 : a.periods);
