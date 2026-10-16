import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Breadcrumb, Empty, PageHeader, StatusBadge } from "@/components/ui";
import ClientForm from "@/components/ClientForm";
import Section from "@/components/Section";
import ClientActivities from "@/components/ClientActivities";
import { Badge } from "@/components/ui";
import { PRIORITY_OPTIONS, PRIORITY_TONE } from "@/lib/constants";
import ChatterSection from "@/components/ChatterSection";
import { RecordBar, RecordProvider } from "@/components/Record";
import { fmtDate } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await prisma.client.findUnique({ relationLoadStrategy: "join",
    where: { id },
    include: {
      leads: { orderBy: { created_at: "desc" }, include: { activities: { include: { type: true } } } },
      projects: { orderBy: { created_at: "desc" } },
      apiKeys: { include: { product: true }, orderBy: { created_at: "asc" } },
    },
  });
  if (!client) notFound();
  const canEdit = can.manageLeads(user.role);

  return (
    <RecordProvider listHref="/clients">
      <div>
        <Breadcrumb items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />
        <PageHeader title={client.name} />
        {canEdit && <RecordBar createHref="/clients/new" />}
        <ClientForm c={client} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Section title="Leads" subtitle={`${client.leads.length} lead`} flush className="self-start">
            {client.leads.length === 0 ? <Empty>Belum ada lead.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {client.leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                    {user.role !== "PROJECT" ? <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.title}</Link> : <span className="font-medium">{l.title}</span>}
                    <span className="flex items-center gap-1.5">
                      <Badge tone={PRIORITY_TONE[l.priority] ?? "slate"}>{PRIORITY_OPTIONS.find((o) => o.value === l.priority)?.label ?? l.priority}</Badge>
                      <StatusBadge status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Projects" subtitle={`${client.projects.length} project`} flush className="self-start">
            {client.projects.length === 0 ? <Empty>Belum ada project.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {client.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Licenses" subtitle={`${client.apiKeys.length} lisensi`} flush className="self-start">
            {client.apiKeys.length === 0 ? <Empty>Belum ada lisensi.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {client.apiKeys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <Link href={`/licenses/${k.id}`} className="font-medium hover:underline">{k.product.name}</Link>
                      <div className="text-xs text-slate-500">s/d {fmtDate(k.expires_at)}</div>
                    </div>
                    <StatusBadge status={effectiveStatus(k)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {user.role !== "PROJECT" && (
          <ClientActivities
            items={client.leads.flatMap((l) => l.activities.map((a) => ({ id: a.id, title: a.title || a.type.name, duration: a.duration_minutes, location: a.location, type: a.type.name, icon: a.type.icon, lead_id: l.id, lead: l.title, stage: a.stage, scheduled_at: a.scheduled_at.toISOString(), notes: a.notes, status: a.status })))}
          />
        )}

        <ChatterSection type="client" id={client.id} label={client.name} />
      </div>
    </RecordProvider>
  );
}
