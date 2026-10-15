import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { idr } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";

export default async function ReportsPage() {
  await requireRole("SUPER_ADMIN");
  const [won, open, keys] = await Promise.all([
    prisma.lead.findMany({ relationLoadStrategy: "join", where: { status: "CLOSED_WON" }, include: { products: { include: { product: true } } } }),
    prisma.leadProduct.findMany({ where: { lead: { status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } } } }),
    prisma.apiKey.findMany({ where: { kind: "PRODUCTION" }, select: { status: true, expires_at: true } }),
  ]);

  const sum = (ls: { price: unknown; quantity: number }[]) => ls.reduce((a, l) => a + Number(l.price) * l.quantity, 0);
  const revenue = sum(won.flatMap((l) => l.products));
  const pipeline = sum(open);

  const byProduct = new Map<string, { name: string; value: number; qty: number }>();
  const byMonth = new Map<string, number>();
  for (const l of won) {
    const m = (l.closed_at ?? l.created_at).toISOString().slice(0, 7);
    for (const p of l.products) {
      const v = Number(p.price) * p.quantity;
      const e = byProduct.get(p.product_id) ?? { name: p.product.name, value: 0, qty: 0 };
      e.value += v; e.qty += p.quantity; byProduct.set(p.product_id, e);
      byMonth.set(m, (byMonth.get(m) ?? 0) + v);
    }
  }
  const prodRows = [...byProduct.values()].sort((a, b) => b.value - a.value);
  const monthRows = [...byMonth.entries()].sort();
  const maxP = Math.max(1, ...prodRows.map((r) => r.value));
  const maxM = Math.max(1, ...monthRows.map(([, v]) => v));
  const keyCounts = keys.reduce<Record<string, number>>((a, k) => { const s = effectiveStatus(k); a[s] = (a[s] ?? 0) + 1; return a; }, {});

  return (
    <div>
      <PageHeader title="Laporan Finansial" subtitle="Hanya dapat diakses Super Admin" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue (Closed Won)" value={idr(revenue)} />
        <Stat label="Nilai pipeline" value={idr(pipeline)} hint="lead belum closed" />
        <Stat label="Deal won" value={won.length} />
        <Stat label="Rata-rata deal" value={idr(won.length ? revenue / won.length : 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Revenue per produk</h2>
          {prodRows.length === 0 ? <Empty>Belum ada data.</Empty> : prodRows.map((r) => (
            <div key={r.name} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span>{r.name} <span className="text-slate-400">×{r.qty}</span></span><span className="font-medium">{idr(r.value)}</span></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${(r.value / maxP) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Revenue per bulan</h2>
          {monthRows.length === 0 ? <Empty>Belum ada data.</Empty> : monthRows.map(([m, v]) => (
            <div key={m} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span>{m}</span><span className="font-medium">{idr(v)}</span></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(v / maxM) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Status lisensi</h2>
          <div className="flex flex-wrap gap-6 text-sm">
            {["ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"].map((s) => <div key={s}><div className="text-2xl font-semibold">{keyCounts[s] ?? 0}</div><div className="text-xs text-slate-500">{s}</div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
