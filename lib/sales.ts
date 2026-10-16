import { prisma } from "./db";

/** Role yang boleh menjadi Sales Person pada lead / activity. */
export const SALES_ROLES = ["SALES", "SUPER_ADMIN"];
export const MAX_DURATION = 1440; // 24 jam

/** Nilai unik dari field multi-pilih (`name` yang sama berulang di FormData). */
export const idsFrom = (fd: FormData, name = "sales_person_ids") => [...new Set(fd.getAll(name).map((v) => String(v).trim()).filter(Boolean))];

/** Pastikan semua id adalah user aktif dengan role sales. Mengembalikan false bila ada yang tidak valid. */
export async function allSalesPersons(ids: string[]) {
  if (ids.length === 0) return true;
  return (await prisma.user.count({ where: { id: { in: ids }, is_active: true, role: { in: SALES_ROLES } } })) === ids.length;
}

/** Durasi activity (menit): bilangan bulat 1–1440, atau null bila tidak valid. */
export function parseDuration(v: unknown) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DURATION ? n : null;
}
