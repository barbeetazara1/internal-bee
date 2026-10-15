import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Alert, Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ConfirmButton from "@/components/ConfirmButton";
import DemoForm from "@/components/DemoForm";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import KeyReveal from "@/components/KeyReveal";
import Section from "@/components/Section";
import { RecordBar, RecordProvider } from "@/components/Record";
import { DEMO_LABEL } from "@/lib/constants";
import { effectiveDemoStatus } from "@/lib/demo";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";
import { cancelDemo, endDemo, startDemo } from "@/app/actions/demo";

export default async function DemoDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; started?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await prisma.demo.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, product: true, apiKeys: true } });
  if (!d) notFound();
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { OR: [{ is_active: true }, { id: d.product_id }] }, orderBy: { code: "asc" } }),
  ]);
  const st = effectiveDemoStatus(d);
  const events = await prisma.activity.findMany({ where: { record_type: "demo", record_id: id, kind: "EVENT" }, orderBy: { created_at: "asc" } });
  const endedAt = events.find((e) => (e.body ?? "").startsWith("Demo ended"))?.created_at ?? (st === "ENDED" ? d.ends_at : null);
  const cancelledAt = events.find((e) => (e.body ?? "").startsWith("Demo request cancelled"))?.created_at ?? null;
  const dates: Record<string, Date | null> = { REQUESTED: d.created_at, ACTIVE: d.started_at, ENDED: endedAt, CANCELLED: cancelledAt };
  const order = ["REQUESTED", "ACTIVE", "ENDED", "CANCELLED"];
  // Dibatalkan: tahap "Berjalan" tidak pernah dicapai, jadi disembunyikan (Diminta → Dibatalkan).
  const flow = st === "CANCELLED" ? ["REQUESTED", "CANCELLED"] : ["REQUESTED", "ACTIVE", "ENDED"];
  const steps: Step[] = flow.map((s) => ({
    status: s,
    label: DEMO_LABEL[s],
    state: s === st ? "current" : order.indexOf(s) < order.indexOf(st) || st === "ENDED" || st === "CANCELLED" ? "done" : "todo",
    date: dates[s] ? fmtDate(dates[s]) : null,
  }));
  const canManage = user.role !== "PROJECT";
  const title = `${d.code} — ${d.client.name}`;

  return (
    <RecordProvider listHref="/demo">
      <div>
        <Breadcrumb items={[{ label: "Demo", href: "/demo" }, { label: title }]} />
        <PageHeader title={title} subtitle={`${d.product.name} · diminta ${fmtDate(d.created_at)}`} />
        {canManage && (
          <RecordBar
            createHref="/demo/new"
            extra={
              <>
                {st === "REQUESTED" && (
                  <form action={startDemo}>
                    <input type="hidden" name="id" value={d.id} />
                    <ConfirmButton title="Mulai demo?" confirmLabel="Ya, Mulai Demo" message={`License key demo (sandbox) untuk ${d.product.name} akan dibuat dan berlaku ${d.demo_days} hari. Key hanya ditampilkan satu kali.`} className="btn border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500">
                      ▶ Mulai Demo
                    </ConfirmButton>
                  </form>
                )}
                {st === "ACTIVE" && (
                  <form action={endDemo}>
                    <input type="hidden" name="id" value={d.id} />
                    <ConfirmButton danger title="Akhiri demo?" confirmLabel="Ya, Akhiri" message="License key demo akan dicabut dan langsung tidak berlaku." className="btn btn-danger">
                      ■ Akhiri Demo
                    </ConfirmButton>
                  </form>
                )}
                {st === "REQUESTED" && (
                  <form action={cancelDemo}>
                    <input type="hidden" name="id" value={d.id} />
                    <ConfirmButton danger title="Batalkan permintaan demo?" confirmLabel="Ya, Batalkan" message="Permintaan demo ini ditandai dibatalkan dan tidak bisa dimulai lagi." className="btn btn-danger">
                      ✕ Batalkan
                    </ConfirmButton>
                  </form>
                )}
              </>
            }
            right={<LeadStatusProgress steps={steps} />}
          />
        )}
        {sp.error && <Alert>{sp.error}</Alert>}
        {sp.started && <KeyReveal />}

        <div className="space-y-6">
          <DemoForm
            locked={d.status !== "REQUESTED"}
            clients={clients.map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }))}
            products={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            d={{ id: d.id, client_id: d.client_id, product_id: d.product_id, contact_name: d.contact_name, email: d.email, phone: d.phone, demo_days: d.demo_days, notes: d.notes }}
          />

          <Section title="License Demo" subtitle={d.apiKeys.length ? `${d.apiKeys.length} key` : "Dibuat saat demo dimulai"} flush>
            {d.apiKeys.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada license key demo. Klik “Mulai Demo” untuk membuatnya.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.apiKeys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <Link href={`/licenses/${k.id}`} className="font-medium hover:underline">{d.product.name}</Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{k.prefix}••••••••{k.key_hint}</code>
                        berlaku s/d {fmtDateTime(k.expires_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2"><StatusBadge status={k.environment} /><StatusBadge status={effectiveStatus(k)} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <ChatterSection type="demo" id={d.id} label={title} />
      </div>
    </RecordProvider>
  );
}
