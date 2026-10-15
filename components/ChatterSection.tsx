import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACCESS, type Change, type RecordType } from "@/lib/activity";
import Chatter, { type ActivityDTO } from "./Chatter";

/** Footer riwayat & komentar untuk sebuah record. Dipasang di bawah form. */
export default async function ChatterSection({ type, id, label }: { type: RecordType; id: string; label: string }) {
  const me = await requireUser();
  const [rows, users] = await Promise.all([
    prisma.activity.findMany({ where: { record_type: type, record_id: id }, orderBy: { created_at: "asc" }, include: { author: { select: { id: true, name: true } } } }),
    prisma.user.findMany({ where: { is_active: true, role: { in: ACCESS[type] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const items: ActivityDTO[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as ActivityDTO["kind"],
    body: r.body,
    changes: (r.changes as Change[] | null) ?? [],
    mentions: (r.mentions as { id: string; name: string }[] | null) ?? [],
    author: r.author,
    created_at: r.created_at.toISOString(),
  }));
  return <Chatter recordType={type} recordId={id} recordLabel={label} items={items} users={users} meId={me.id} />;
}
