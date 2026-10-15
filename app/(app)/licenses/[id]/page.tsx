import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import ActionBar from "@/components/ActionBar";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import KeyReveal from "@/components/KeyReveal";
import ConfirmButton from "@/components/ConfirmButton";
import Section from "@/components/Section";
import ChatterSection from "@/components/ChatterSection";
import { addDays, fmtDate, fmtDateTime } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";
import { reactivateKey, revokeKey, rotateKey, suspendKey } from "@/app/actions/keys";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function LicenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const k = await prisma.apiKey.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, product: true, project: true, demo: true } });
  if (!k) notFound();

  const siblings = await prisma.apiKey.findMany({ relationLoadStrategy: "join", where: { client_id: k.client_id, id: { not: k.id } }, include: { product: true }, orderBy: { created_at: "asc" } });
  const st = effectiveStatus(k);
  const manage = can.manageLicense(user.role);
  const title = `${k.client.name} — ${k.product.name}`;
  const susp = await prisma.activity.findFirst({ where: { record_type: "license", record_id: id, kind: "EVENT", body: { startsWith: "API key suspended" } }, orderBy: { created_at: "desc" } });
  const LL: Record<string, string> = { L_ACTIVE: "Aktif", SUSPENDED: "Ditangguhkan", EXPIRED: "Kedaluwarsa", REVOKED: "Dicabut" };
  const when: Record<string, Date | null> = { L_ACTIVE: k.created_at, SUSPENDED: susp?.created_at ?? null, EXPIRED: k.expires_at, REVOKED: k.revoked_at };
  const keyFlow = st === "REVOKED" ? ["L_ACTIVE", "REVOKED"] : st === "EXPIRED" ? ["L_ACTIVE", "EXPIRED"] : st === "SUSPENDED" ? ["L_ACTIVE", "SUSPENDED", "EXPIRED"] : ["L_ACTIVE", "EXPIRED"];
  const cur = st === "ACTIVE" ? "L_ACTIVE" : st;
  const steps: Step[] = keyFlow
    .filter((s) => s !== "EXPIRED" || k.expires_at) // lisensi one-time tidak punya masa kedaluwarsa
    .map((s, i, arr) => ({ status: s, label: LL[s], state: s === cur ? "current" : i < arr.findIndex((x) => x === cur) ? "done" : "todo", date: s === "EXPIRED" && cur !== "EXPIRED" ? null : when[s] ? fmtDate(when[s]) : null }));
  const mask = `${k.prefix}••••••••${k.key_hint}`;

  const since = new Date(addDays(new Date(), -13).toDateString());
  const logs = await prisma.usageLog.findMany({ where: { api_key_id: k.id, created_at: { gte: since } }, select: { created_at: true } });
  const days = Array.from({ length: 14 }, (_, i) => addDays(since, i));
  const perDay = days.map((d) => logs.filter((l) => l.created_at.toDateString() === d.toDateString()).length);
  const maxDay = Math.max(1, ...perDay);

  return (
    <div>
      <Breadcrumb items={[{ label: "Licenses", href: "/licenses" }, { label: k.kind === "DEMO" ? "Demo" : "Production", href: k.kind === "DEMO" ? "/licenses/demo" : "/licenses" }, { label: title }]} />
      <PageHeader title={title} />
      <ActionBar right={<LeadStatusProgress steps={steps} />}>
        {manage && k.status !== "REVOKED" && k.status !== "SUSPENDED" && (
          <form action={rotateKey}><input type="hidden" name="id" value={k.id} /><ConfirmButton title="Refresh token?" confirmLabel="Refresh Token" message="Token lama langsung tidak berlaku dan token baru hanya ditampilkan satu kali. Pastikan Anda siap menyalin dan membagikannya ke client." className="btn">Refresh Token</ConfirmButton></form>
        )}
        {manage && k.status === "ACTIVE" && <form action={suspendKey}><input type="hidden" name="id" value={k.id} /><button className="btn">Suspend</button></form>}
        {manage && k.status === "SUSPENDED" && <form action={reactivateKey}><input type="hidden" name="id" value={k.id} /><button className="btn">Aktifkan</button></form>}
        {can.revokeKey(user.role) && k.status !== "REVOKED" && (
          <form action={revokeKey}><input type="hidden" name="id" value={k.id} /><ConfirmButton danger title="Revoke key ini?" confirmLabel="Revoke" message="Key dicabut permanen dan tidak bisa diaktifkan atau di-refresh lagi. Tindakan ini tidak dapat dibatalkan." className="btn btn-danger">Revoke</ConfirmButton></form>
        )}
      </ActionBar>
      <KeyReveal />

      <div className="space-y-6">
        <Section title="Informasi License" subtitle="Siapa pemilik dan produk apa yang dilisensikan">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Client"><Link href={`/clients/${k.client_id}`} className="font-medium hover:underline">{k.client.name}</Link></Field>
            <Field label="Produk">{k.product.name} <span className="font-mono text-xs text-slate-500">{k.product.code}</span></Field>
            <Field label="Key"><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{mask}</code></Field>
            <Field label="Environment"><StatusBadge status={k.environment} /></Field>
            <Field label="Jenis License">{k.kind === "DEMO" ? <span className="inline-flex items-center gap-2"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">Demo</span>{k.demo && <Link href={`/demo/${k.demo.id}`} className="font-mono text-xs hover:underline">{k.demo.code}</Link>}</span> : "Production"}</Field>
            <Field label="Project">{k.project ? <Link href={`/projects/${k.project.id}`} className="hover:underline">{k.project.name}</Link> : "—"}</Field>
          </div>
        </Section>
        <Section title="Status & Masa Berlaku" subtitle="Kondisi key dan riwayat penggunaan terakhir">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Status"><StatusBadge status={st} /></Field>
            <Field label="Berlaku s/d">{fmtDate(k.expires_at)}</Field>
            <Field label="Dibuat">{fmtDateTime(k.created_at)}</Field>
            <Field label="Terakhir dipakai">{fmtDateTime(k.last_used_at)}</Field>
            <Field label="Token terakhir di-refresh">{fmtDateTime(k.rotated_at)}</Field>
          </div>
        </Section>
      </div>

      {siblings.length > 0 && (
        <Section className="mt-6" title={`Lisensi Lain Milik ${k.client.name}`} subtitle={`${siblings.length} lisensi`} flush>
          <ul className="divide-y divide-slate-100">
            {siblings.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                <Link href={`/licenses/${x.id}`} className="font-medium hover:underline">{x.product.name}</Link>
                <div className="flex items-center gap-2"><StatusBadge status={x.environment} /><StatusBadge status={effectiveStatus(x)} /></div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section className="mt-6" title="Usage Metrics" subtitle="Request per hari, 14 hari terakhir">
        <div className="flex h-32 items-end gap-1.5">
          {perDay.map((n, i) => (
            <div key={i} className="group flex flex-1 flex-col items-center justify-end" title={`${fmtDate(days[i])}: ${n} request`}>
              <div className="w-full rounded-t bg-amber-400 transition group-hover:bg-amber-500" style={{ height: `${Math.max(n ? 4 : 1, (n / maxDay) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{fmtDate(days[0])}</span><span>{fmtDate(days[13])}</span></div>
        <p className="mt-3 text-xs text-slate-400">Uji key: <code>curl -H &quot;x-api-key: ib_live_…&quot; http://localhost:3400/api/v1/verify</code></p>
      </Section>

      <ChatterSection type="license" id={k.id} label={title} />
    </div>
  );
}
