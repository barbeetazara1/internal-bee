const MON = { id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
const p2 = (n: number) => String(n).padStart(2, "0");

/** Waktu activity di zona waktu perangkat pengguna: "17 Okt 2026, 14:30". Dipakai di komponen klien (server tidak tahu zona waktu pengguna). */
export function fmtWhen(iso: string, lang: "id" | "en" = "id") {
  const d = new Date(iso);
  return `${d.getDate()} ${MON[lang][d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export type ActivityState = "PLANNED" | "OVERDUE" | "DONE";
export const activityState = (a: { status: string; scheduled_at: string }, now = Date.now()): ActivityState =>
  a.status === "DONE" ? "DONE" : new Date(a.scheduled_at).getTime() < now ? "OVERDUE" : "PLANNED";
export const ACTIVITY_STATE_LABEL: Record<ActivityState, string> = { PLANNED: "Terjadwal", OVERDUE: "Terlambat", DONE: "Selesai" };
export const ACTIVITY_STATE_TONE: Record<ActivityState, "amber" | "red" | "green"> = { PLANNED: "amber", OVERDUE: "red", DONE: "green" };
