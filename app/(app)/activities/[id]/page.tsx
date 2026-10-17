import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Breadcrumb, PageHeader } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import DatePicker from "@/components/DatePicker";
import Section from "@/components/Section";
import Select from "@/components/Select";
import MultiSelect from "@/components/MultiSelect";
import DurationField from "@/components/DurationField";
import ActivityTypeLocation from "@/components/ActivityTypeLocation";
import { RecordForm, RecordProvider } from "@/components/Record";
import { LEAD_FINAL, LEAD_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { saveLeadActivity } from "@/app/actions/lead-activities";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Form Activity: judul, jenis, jadwal (tanggal & waktu), status, dan catatan; bagian kanan memuat lead/client terkait. */
export default async function ActivityDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const a = await prisma.leadActivity.findUnique({
    where: { id },
    relationLoadStrategy: "join",
    include: { type: true, created_by: { select: { name: true } }, sales_persons: { select: { id: true, name: true } }, lead: { include: { client: { select: { id: true, name: true } }, sales_persons: { select: { id: true, name: true } } } } },
  });
  if (!a) notFound();
  const types = await prisma.activityType.findMany({ where: { OR: [{ is_active: true }, { id: a.type_id }] }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  const closed = (LEAD_FINAL as readonly string[]).includes(a.lead.status);
  const title = a.title || a.type.name;

  return (
    <RecordProvider listHref="/activities">
      <div>
        <Breadcrumb items={[{ label: "Opportunities" }, { label: "Activity", href: "/activities" }, { label: title }]} />
        <PageHeader title={title} subtitle={`${a.type.name} · ${a.lead.title}`} />
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Activity hanya bisa dilihat di sini. Untuk mengubahnya, buka <Link href={`/leads/${a.lead_id}`} className="font-medium underline">lead terkait</Link> dan masuk ke mode edit.</div>
        <RecordForm action={saveLeadActivity} locked className="fields-compact">
          <input type="hidden" name="id" value={a.id} />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Section title="Detail Activity" subtitle="Judul, jenis, jadwal, dan catatan">
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label">Judul Activity<span className="text-red-500"> *</span></label><input name="title" required maxLength={120} defaultValue={title} className="input" /></div>
                <ActivityTypeLocation
                  types={types.map((t) => ({ id: t.id, name: t.name, needs_location: t.needs_location }))}
                  defaultType={a.type_id}
                  defaultLocation={a.location ?? ""}
                  status={<><label className="label">Status</label><Select name="status" options={[{ value: "PLANNED", label: "Terjadwal" }, { value: "DONE", label: "Selesai" }]} defaultValue={a.status} /></>}
                />
                <div><label className="label">Tanggal &amp; Waktu<span className="text-red-500"> *</span></label><DatePicker name="scheduled_at" time required defaultValue={a.scheduled_at.toISOString()} /></div>
                <div><label className="label">Durasi (menit)<span className="text-red-500"> *</span></label><DurationField defaultValue={a.duration_minutes} /></div>
                <div className="sm:col-span-2">
                  <label className="label">Sales Person</label>
                  <MultiSelect name="sales_person_ids" options={[...a.lead.sales_persons, ...a.sales_persons.filter((p) => !a.lead.sales_persons.some((l) => l.id === p.id))].map((u) => ({ value: u.id, label: u.name }))} defaultValue={a.sales_persons.map((u) => u.id)} placeholder="Pilih sales person…" emptyText="Lead ini belum punya sales person" />
                </div>
                <div className="sm:col-span-2"><label className="label">Catatan tambahan <span className="font-normal text-slate-400">(opsional)</span></label><textarea name="notes" rows={4} maxLength={2000} defaultValue={a.notes ?? ""} className="input" /></div>
              </div>
            </Section>
            <Section title="Terkait" subtitle="Lead dan client pemilik activity ini">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Lead"><Link href={`/leads/${a.lead_id}`} className="font-medium hover:underline">{a.lead.title}</Link></Field>
                <Field label="Client"><Link href={`/clients/${a.lead.client.id}`} className="hover:underline">{a.lead.client.name}</Link></Field>
                <Field label="Tahap saat dibuat"><Badge>{LEAD_LABEL[a.stage] ?? a.stage}</Badge></Field>
                <Field label="Status lead saat ini"><Badge tone={closed ? "slate" : "amber"}>{LEAD_LABEL[a.lead.status] ?? a.lead.status}</Badge></Field>
                <Field label="Dibuat oleh">{a.created_by.name}</Field>
                <Field label="Dibuat pada">{fmtDateTime(a.created_at)}</Field>
                {a.done_at && <Field label="Selesai pada">{fmtDateTime(a.done_at)}</Field>}
              </div>
            </Section>
          </div>
        </RecordForm>
        <ChatterSection type="activity" id={a.id} label={title} />
      </div>
    </RecordProvider>
  );
}
