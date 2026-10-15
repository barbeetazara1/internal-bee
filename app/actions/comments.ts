"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACCESS, recordLink, type RecordType } from "@/lib/activity";
import type { ActionResult } from "@/lib/result";

async function labelOf(type: RecordType, id: string): Promise<string | null> {
  switch (type) {
    case "product": return (await prisma.product.findUnique({ where: { id } }))?.name ?? null;
    case "lead": return (await prisma.lead.findUnique({ where: { id } }))?.title ?? null;
    case "client": return (await prisma.client.findUnique({ where: { id } }))?.name ?? null;
    case "project": return (await prisma.project.findUnique({ where: { id } }))?.name ?? null;
    case "task": return (await prisma.task.findUnique({ where: { id } }))?.title ?? null;
    case "bill": return (await prisma.bill.findUnique({ where: { id } }))?.code ?? null;
    case "demo": {
      const d = await prisma.demo.findUnique({ where: { id }, include: { client: true } });
      return d ? `${d.code} — ${d.client.name}` : null;
    }
    case "license": {
      const k = await prisma.apiKey.findUnique({ where: { id }, include: { client: true, product: true } });
      return k ? `${k.client.name} — ${k.product.name}` : null;
    }
  }
}

export async function addComment(type: RecordType, id: string, body: string, mentionIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (!ACCESS[type]?.includes(user.role)) return { ok: false, message: "You don't have access to this record" };
  const text = body.trim();
  if (!text) return { ok: false, message: "Comment can't be empty" };
  if (text.length > 4000) return { ok: false, message: "Comment is too long" };
  const label = await labelOf(type, id);
  if (!label) return { ok: false, message: "Record not found" };

  // Hanya user aktif yang punya akses ke record, dan namanya benar-benar muncul sebagai @Nama di teks.
  const candidates = await prisma.user.findMany({ where: { id: { in: mentionIds }, is_active: true, role: { in: ACCESS[type] } }, select: { id: true, name: true } });
  const mentions = candidates.filter((u) => text.includes(`@${u.name}`));

  const activity = await prisma.activity.create({
    data: { record_type: type, record_id: id, kind: "COMMENT", body: text, mentions, record_label: label, author_id: user.id },
  });
  const targets = mentions.filter((m) => m.id !== user.id);
  if (targets.length) await prisma.notification.createMany({ data: targets.map((m) => ({ user_id: m.id, activity_id: activity.id })) });

  if (type === "task") {
    const t = await prisma.task.findUnique({ where: { id }, select: { project_id: true } });
    if (t) revalidatePath(`/projects/${t.project_id}/tasks/${id}`);
  } else revalidatePath(recordLink(type, id));
  revalidatePath("/", "layout");
  return { ok: true, message: targets.length ? `Comment posted · ${targets.length} user notified` : "Comment posted" };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id, user_id: user.id, read_at: null }, data: { read_at: new Date() } });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { user_id: user.id, read_at: null }, data: { read_at: new Date() } });
  revalidatePath("/", "layout");
}
