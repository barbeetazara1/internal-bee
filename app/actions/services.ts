"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { diffFields, logActivity } from "@/lib/activity";
import { decryptSecret, encryptSecret } from "@/lib/secret";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
const LABELS = { provider: "Purchased from", domain_name: "Domain name", server_ip: "Server IP", server_port: "Port", server_user: "User", notes: "Notes" };

/** Detail layanan (vendor, domain, akses server). Akses server (IP/port/user/password) hanya untuk Super Admin & Project. */
export async function saveServiceDetails(fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!can.manageProjects(user.role)) return { ok: false, message: "You don't have access to this record" };
  const id = str(fd, "id", 64);
  const cur = await prisma.service.findUnique({ where: { id } });
  if (!cur) return { ok: false, message: "Service not found" };

  const portRaw = str(fd, "server_port", 6);
  const port = portRaw ? Number(portRaw) : null;
  if (port !== null && !(Number.isInteger(port) && port >= 1 && port <= 65535)) return { ok: false, message: "Port must be between 1 and 65535" };
  const next = {
    provider: str(fd, "provider", 120) || null,
    domain_name: str(fd, "domain_name", 253).toLowerCase() || null,
    server_ip: str(fd, "server_ip", 100) || null,
    server_port: port,
    server_user: str(fd, "server_user", 120) || null,
    notes: str(fd, "notes", 2000) || null,
  };
  const pw = String(fd.get("password") ?? ""); // kosong = tidak diubah
  if (pw.length > 200) return { ok: false, message: "Password is too long" };
  // Riwayat bisa dilihat semua role: nilai akses server (IP/port/user) tidak dicatat, hanya bahwa field itu berubah
  const SENSITIVE = new Set(["Server IP", "Port", "User"]);
  const changes = diffFields(LABELS, cur, next).map((c) => (SENSITIVE.has(c.field) ? { field: c.field, from: "••••", to: "changed" } : c));
  if (pw) changes.push({ field: "Password", from: "••••••", to: "changed" });
  if (changes.length === 0) return { ok: true, changed: false, message: "No changes made" };

  await prisma.service.update({ where: { id }, data: { ...next, ...(pw ? { secret_enc: encryptSecret(pw) } : {}) } });
  await logActivity(prisma, { type: "service", id, kind: "UPDATED", authorId: user.id, label: cur.name, changes });
  revalidatePath(`/services/${id}`);
  revalidatePath("/services");
  return { ok: true, changed: true, message: "Data saved" };
}

/** Menampilkan password server (sekali per klik). Hanya Super Admin & Project; setiap penampilan dicatat di riwayat layanan. */
export async function revealServicePassword(id: string): Promise<{ ok: boolean; message?: string; password?: string }> {
  const user = await requireUser();
  if (!can.manageProjects(user.role)) return { ok: false, message: "You don't have access to this record" };
  const s = await prisma.service.findUnique({ where: { id }, select: { secret_enc: true, name: true } });
  if (!s?.secret_enc) return { ok: false, message: "No password saved" };
  const password = decryptSecret(s.secret_enc);
  if (password === null) return { ok: false, message: "The saved password can't be decrypted" };
  await logActivity(prisma, { type: "service", id, kind: "EVENT", authorId: user.id, label: s.name, body: "Server password viewed" });
  return { ok: true, password };
}
