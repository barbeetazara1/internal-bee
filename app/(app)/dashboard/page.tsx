import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Alert, PageHeader, Stat, StatusBadge, Empty } from "@/components/ui";
import { LEAD_LABEL, LEAD_STATUSES } from "@/lib/constants";
import { addDays, fmtDate, idr } from "@/lib/format";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const in30 = addDays(now, 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [leadGroups, wonMonth, clients, activeKeys, expiring, openTasks, recentLeads, wonLines] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.count({ where: { status: "CLOSED_WON", closed_at: { gte: monthStart } } }),
    prisma.client.count(),
    prisma.apiKey.count({ where: { kind: "PRODUCTION", status: "ACTIVE", OR: [{ expires_at: null }, { expires_at: { gt: now } }] } }),
    prisma.apiKey.findMany({
      where: { kind: "PRODUCTION", status: "ACTIVE", expires_at: { gt: now, lte: in30 } },
      include: { client: true, product: true },
      orderBy: { expires_at: "asc" },
      take: 5,
    }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.lead.findMany({ orderBy: { created_at: "desc" }, take: 5, include: { owner: true, client: true } }),
    user.role === "SUPER_ADMIN" ? prisma.leadProduct.findMany({ where: { lead: { status: "CLOSED_WON" } } }) : Promise.resolve([]),
  ]);
  const counts = Object.fromEntries(leadGroups.map((g) => [g.status, g._count]));
  const open = LEAD_STATUSES.filter((s) => !s.startsWith("CLOSED")).reduce((a, s) => a + (counts[s] ?? 0), 0);
  const revenue = wonLines.reduce((a, l) => a + Number(l.price) * l.quantity, 0);
  const maxCount = Math.max(1, ...LEAD_STATUSES.map((s) => counts[s] ?? 0));

  return (
    <div>
      {sp.denied && <Alert>Anda tidak memiliki akses ke halaman tersebut.</Alert>}
      <PageHeader title={`Halo, ${user.name.split(" ")[0]} 👋`} subtitle="Ringkasan operasional Internal Bee hari ini" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Lead aktif" value={open} hint="belum closed" />
        <Stat label="Deal bulan ini" value={wonMonth} hint="Closed Won" />
        <Stat label="Client" value={clients} />
        <Stat label="API Key aktif" value={activeKeys} />
        {user.role === "SUPER_ADMIN" ? <Stat label="Total revenue" value={idr(revenue)} hint="Closed Won" /> : <Stat label="Task terbuka" value={openTasks} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Pipeline Lead</h2>
          <div className="space-y-2.5">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-slate-500">{LEAD_LABEL[s]}</div>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div className={`h-2.5 rounded-full ${s === "CLOSED_WON" ? "bg-emerald-500" : s === "CLOSED_LOST" ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${((counts[s] ?? 0) / maxCount) * 100}%` }} />
                </div>
                <div className="w-6 text-right font-medium">{counts[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">License akan berakhir ≤ 30 hari</h2>
          {expiring.length === 0 ? (
            <Empty>Tidak ada lisensi yang segera berakhir.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expiring.map((k) => (
                <li key={k.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <Link href={`/licenses/${k.id}`} className="font-medium hover:text-amber-600">{k.client.name}</Link>
                    <div className="text-xs text-slate-500">{k.product.name}</div>
                  </div>
                  <div className="text-xs text-red-600">{fmtDate(k.expires_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {user.role !== "PROJECT" && (
          <div className="card lg:col-span-2">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Lead terbaru</h2>
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {recentLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="td"><Link href={`/leads/${l.id}`} className="font-medium hover:text-amber-600">{l.title}</Link><div className="text-xs text-slate-500">{l.client.name}</div></td>
                    <td className="td text-slate-500">{l.owner.name}</td>
                    <td className="td"><StatusBadge status={l.status} /></td>
                    <td className="td text-right text-slate-400">{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
