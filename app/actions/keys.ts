"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser, requireRole } from "@/lib/auth";
import { generateKey, type Env } from "@/lib/keys";
import { setKeyFlash, type RevealedKey } from "@/lib/flash";
import { logActivity, purgeActivities } from "@/lib/activity";
import type { ActionResult } from "@/lib/result";

/** Dipanggil sekali oleh <KeyReveal/>: membaca lalu menghapus cookie flash (One-Time Key Display). */
export async function consumeKeyFlash(): Promise<RevealedKey[]> {
  if (!(await getUser())) return [];
  const jar = await cookies();
  const raw = jar.get("ib_keys")?.value;
  if (!raw) return [];
  jar.delete("ib_keys");
  try {
    return JSON.parse(raw) as RevealedKey[];
  } catch {
    return [];
  }
}

async function load(fd: FormData) {
  const id = String(fd.get("id"));
  const key = await prisma.apiKey.findUnique({ relationLoadStrategy: "join", where: { id }, include: { product: true, client: true } });
  if (!key) throw new Error("Key tidak ditemukan");
  return key;
}

export async function rotateKey(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const key = await load(fd);
  if (key.status === "REVOKED" || key.status === "SUSPENDED") redirect(`/licenses/${key.id}`); // key beku/dicabut tidak bisa di-refresh
  const k = generateKey(key.environment as Env);
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { key_hash: k.hash, prefix: k.prefix, key_hint: k.hint, rotated_at: new Date() },
  });
  await setKeyFlash([{ product: `${key.product.code} — ${key.product.name}`, environment: key.environment, key: k.plain }]);
  await logActivity(prisma, { type: "license", id: key.id, kind: "EVENT", authorId: user.id, label: `${key.client.name} — ${key.product.name}`, body: `Token refreshed: ${key.product.code} (${key.environment}), ending ${k.hint}` });

  revalidatePath(`/licenses/${key.id}`);
  revalidatePath("/licenses");
  redirect(`/licenses/${key.id}?rotated=1`);
}

export async function suspendKey(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const key = await load(fd);
  if (key.status === "ACTIVE") {
    await prisma.apiKey.update({ where: { id: key.id }, data: { status: "SUSPENDED" } });
    await logActivity(prisma, { type: "license", id: key.id, kind: "EVENT", authorId: user.id, label: `${key.client.name} — ${key.product.name}`, body: `API key suspended: ${key.product.code} (${key.environment}), ending ${key.key_hint}` });
  }
  revalidatePath(`/licenses/${key.id}`);
  revalidatePath("/licenses");
}

export async function reactivateKey(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN", "PROJECT");
  const key = await load(fd);
  if (key.status === "SUSPENDED") {
    await prisma.apiKey.update({ where: { id: key.id }, data: { status: "ACTIVE" } });
    await logActivity(prisma, { type: "license", id: key.id, kind: "EVENT", authorId: user.id, label: `${key.client.name} — ${key.product.name}`, body: `API key reactivated: ${key.product.code} (${key.environment}), ending ${key.key_hint}` });
  }
  revalidatePath(`/licenses/${key.id}`);
  revalidatePath("/licenses");
}

export async function revokeKey(fd: FormData) {
  const user = await requireRole("SUPER_ADMIN");
  const key = await load(fd);
  await prisma.apiKey.update({ where: { id: key.id }, data: { status: "REVOKED", revoked_at: new Date() } });
  await logActivity(prisma, { type: "license", id: key.id, kind: "EVENT", authorId: user.id, label: `${key.client.name} — ${key.product.name}`, body: `API key revoked: ${key.product.code} (${key.environment}), ending ${key.key_hint}` });

  revalidatePath(`/licenses/${key.id}`);
  revalidatePath("/licenses");
}

export async function deleteLicenses(ids: string[]): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  await prisma.apiKey.deleteMany({ where: { id: { in: ids } } }); // UsageLog ikut terhapus (cascade)
  await purgeActivities("license", ids);
  revalidatePath("/licenses");
  return { ok: true, changed: true, message: `${ids.length} license(s) deleted` };
}
