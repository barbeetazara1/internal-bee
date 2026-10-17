import { prisma } from "./db";
import { ADDON_BILLING_LABEL, ADDON_DEFAULT_PERIODS, ADDON_MAX_PERIODS } from "./addons";

export type ResolvedAddon = { id?: string; addon_id: string; quantity: number; price: number; billing: string; periods: number; client_managed: boolean; product_id: string | null };

/** Memvalidasi baris add-on dari form (JSON). `productIds` = produk yang sudah tersimpan pada lead (untuk "berlaku untuk"). */
export async function resolveAddons(raw: string, productIds: string[]): Promise<{ ok: false; message: string } | { ok: true; lines: ResolvedAddon[] }> {
  let arr: { id?: string; addon_id: string; quantity?: number; price?: number; billing?: string; periods?: number; client_managed?: boolean; product_id?: string | null }[];
  try {
    arr = raw ? JSON.parse(raw) : [];
  } catch {
    return { ok: false, message: "Invalid add-on lines" };
  }
  const seen = new Set<string>();
  for (const r of arr) {
    if (!r.addon_id) return { ok: false, message: "Choose an add-on for every add-on line" };
    if (seen.has(r.addon_id)) return { ok: false, message: "An add-on can only be added once" };
    seen.add(r.addon_id);
  }
  const found = await prisma.addon.count({ where: { id: { in: arr.map((r) => r.addon_id) } } });
  if (found !== arr.length) return { ok: false, message: "One of the selected add-ons no longer exists" };
  const lines: ResolvedAddon[] = [];
  for (const r of arr) {
    const billing = String(r.billing);
    if (!(billing in ADDON_BILLING_LABEL)) return { ok: false, message: "Choose a billing period" };
    if (!Number.isFinite(Number(r.price)) || Number(r.price) < 0) return { ok: false, message: "Price can't be negative" };
    const quantity = Math.round(Number(r.quantity ?? 1));
    if (!(quantity >= 1 && quantity <= 999)) return { ok: false, message: "Quantity must be at least 1" };
    const periods = billing === "ONE_TIME" ? 1 : Math.round(Number(r.periods ?? ADDON_DEFAULT_PERIODS[billing]));
    if (!(periods >= 1 && periods <= ADDON_MAX_PERIODS)) return { ok: false, message: `Billing length must be between 1 and ${ADDON_MAX_PERIODS}` };
    const product_id = r.product_id || null;
    if (product_id && !productIds.includes(product_id)) return { ok: false, message: "An add-on can only apply to a product already saved on this lead" };
    lines.push({ id: r.id, addon_id: r.addon_id, quantity, price: Math.round(Number(r.price)), billing, periods, client_managed: !!r.client_managed, product_id });
  }
  return { ok: true, lines };
}

export const describeAddon = (a: { price: number; quantity: number; billing: string; periods: number; client_managed: boolean }) =>
  a.client_managed ? "managed by client" : `${a.price.toLocaleString("id-ID")} × ${a.quantity} · ${ADDON_BILLING_LABEL[a.billing] ?? a.billing}${a.billing === "ONE_TIME" ? "" : ` × ${a.periods}`}`;
