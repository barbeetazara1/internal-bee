"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/lib/result";

const str = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Simpan pengaturan template proposal (mode + isi teks). Field kosong = memakai isi bawaan. */
export async function saveProposalSettings(fd: FormData): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  const mode = fd.get("mode") === "PDF" ? "PDF" : "TEXT";
  const days = Math.round(Number(fd.get("validity_days")));
  if (!Number.isFinite(days) || days < 1 || days > 365) return { ok: false, message: "Validity must be between 1 and 365 days" };
  const nul = (v: string) => v || null;
  const data = {
    mode,
    company_name: nul(str(fd, "company_name", 120)), tagline: nul(str(fd, "tagline", 160)), title: nul(str(fd, "title", 120)),
    intro: nul(str(fd, "intro", 3000)), scope: nul(str(fd, "scope", 3000)), terms: nul(str(fd, "terms", 3000)), closing: nul(str(fd, "closing", 3000)),
    signer_name: nul(str(fd, "signer_name", 120)), signer_title: nul(str(fd, "signer_title", 120)), footer: nul(str(fd, "footer", 300)), validity_days: days,
  };
  await prisma.proposalSetting.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  revalidatePath("/settings/proposal");
  return { ok: true, changed: true, message: "Data saved" };
}
