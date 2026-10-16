export type Role = "SUPER_ADMIN" | "SALES" | "PROJECT";

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SALES: "Karyawan (Sales)",
  PROJECT: "Karyawan (Project)",
};

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const;
/** Status lead hanya boleh maju: tidak bisa kembali ke status sebelumnya, dan Closed Won / Closed Lost bersifat final. */
export const LEAD_FINAL = ["CLOSED_WON", "CLOSED_LOST"] as const;
export const canMoveLead = (from: string, to: string) => {
  const order = LEAD_STATUSES as readonly string[];
  return !(LEAD_FINAL as readonly string[]).includes(from) && order.indexOf(to) > order.indexOf(from);
};
/** Detail lead terkunci begitu status lewat "Baru"; baris produk tetap bisa diubah sampai Negosiasi (client bisa mengubah kebutuhan) dan terkunci setelah Closed Won / Closed Lost. */
export const leadDetailLocked = (status: string) => status !== "NEW";
export const leadProductsLocked = (status: string) => (LEAD_FINAL as readonly string[]).includes(status);
export const LEAD_LABEL: Record<string, string> = {
  NEW: "Baru",
  CONTACTED: "Dihubungi",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negosiasi",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
};

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export const TASK_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const LICENSE_TYPES = ["YEARLY", "MONTHLY", "ONE_TIME"] as const;
/** Masa berlaku (bulan) mengikuti tipe lisensi produk. 0 = sekali bayar, tanpa masa kedaluwarsa. */
export const licenseMonths = (type: string) => ({ YEARLY: 12, MONTHLY: 1, ONE_TIME: 0 } as Record<string, number>)[type] ?? 12;
/** Tipe lisensi dari masa berlaku yang tersimpan di baris lead. */
export const licenseTypeOf = (months: number) => (months === 0 ? "ONE_TIME" : months === 1 ? "MONTHLY" : "YEARLY");
export const LICENSE_LABEL: Record<string, string> = { YEARLY: "Tahunan", MONTHLY: "Bulanan", ONE_TIME: "One-time" };

export type Option = { value: string; label: string };
const toOpts = (labels: Record<string, string>): Option[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

export const ROLE_OPTIONS = toOpts(ROLE_LABEL);
export const LICENSE_OPTIONS: Option[] = LICENSE_TYPES.map((v) => ({ value: v, label: LICENSE_LABEL[v] }));
export const TASK_STATUS_OPTIONS = toOpts(TASK_LABEL);
export const PRIORITY_OPTIONS: Option[] = [{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }];
/** Warna chip prioritas lead / task. */
export const PRIORITY_TONE: Record<string, "slate" | "amber" | "red"> = { LOW: "slate", MEDIUM: "amber", HIGH: "red" };
export const ENV_OPTIONS: Option[] = [{ value: "PRODUCTION", label: "Production" }, { value: "SANDBOX", label: "Sandbox" }];
export const PROJECT_STATUS_OPTIONS: Option[] = [{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On Hold" }, { value: "COMPLETED", label: "Completed" }];

/** Demo: permintaan demo dari client; saat dimulai dibuat license key demo (sandbox) berjangka waktu. */
export const DEMO_STATUSES = ["REQUESTED", "ACTIVE", "ENDED", "CANCELLED"] as const;
export const DEMO_LABEL: Record<string, string> = { REQUESTED: "Diminta", ACTIVE: "Berjalan", ENDED: "Selesai", CANCELLED: "Dibatalkan" };
export const DEMO_TONE: Record<string, "amber" | "green" | "slate" | "red"> = { REQUESTED: "amber", ACTIVE: "green", ENDED: "slate", CANCELLED: "red" };
export const DEFAULT_DEMO_DAYS = 14;

/** Bill: terbentuk otomatis dari lead Closed Won. OVERDUE bukan status tersimpan, melainkan UNPAID yang lewat jatuh tempo. */
export const BILL_LABEL: Record<string, string> = { UNPAID: "Belum Dibayar", OVERDUE: "Terlambat", PAID: "Lunas", CANCELLED: "Dibatalkan" };
export const effectiveBillStatus = (b: { status: string; due_date: Date | string }) =>
  b.status === "UNPAID" && new Date(b.due_date).getTime() < new Date(new Date().toDateString()).getTime() ? "OVERDUE" : b.status;
