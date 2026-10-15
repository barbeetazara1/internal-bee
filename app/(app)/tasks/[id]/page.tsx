import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Tautan pendek ke sebuah task (dipakai notifikasi mention): diarahkan ke halaman task di dalam project-nya. */
export default async function TaskRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const t = await prisma.task.findUnique({ where: { id }, select: { project_id: true } });
  if (!t) notFound();
  redirect(`/projects/${t.project_id}/tasks/${id}`);
}
