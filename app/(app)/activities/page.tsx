import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, SummaryCards } from "@/components/ui";
import ActivityList, { type ActivityRow } from "@/components/ActivityList";
import ActivityCalendar from "@/components/ActivityCalendar";
import ViewToggle from "@/components/ViewToggle";

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const view: "list" | "calendar" = (await searchParams).view === "list" ? "list" : "calendar";
  const rows = await prisma.leadActivity.findMany({
    relationLoadStrategy: "join",
    orderBy: { scheduled_at: "desc" },
    include: { type: true, created_by: { select: { name: true } }, sales_persons: { select: { name: true } }, lead: { select: { id: true, title: true, status: true, client: { select: { name: true } } } } },
  });
  const items: ActivityRow[] = rows.map((a) => ({
    id: a.id, title: a.title || a.type.name, type: a.type.name, icon: a.type.icon, lead_id: a.lead.id, lead: a.lead.title, client: a.lead.client.name, stage: a.stage,
    scheduled_at: a.scheduled_at.toISOString(), duration: a.duration_minutes, location: a.location ?? "", sales: a.sales_persons.map((p) => p.name), notes: a.notes, status: a.status, by: a.created_by.name,
  }));
  const now = Date.now();
  const planned = items.filter((a) => a.status === "PLANNED");
  const overdue = planned.filter((a) => new Date(a.scheduled_at).getTime() < now);
  const today = new Date().toDateString();
  const todays = planned.filter((a) => new Date(a.scheduled_at).toDateString() === today);
  return (
    <div>
      <PageHeader title="Activity" subtitle="Semua activity pada lead — jadwal call, meeting, demo, dan tindak lanjut lainnya">
        <ViewToggle base="/activities" current={view} modes={["list", "calendar"]} />
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Terjadwal", value: planned.length, hint: `${todays.length} hari ini` },
          { label: "Terlambat", value: overdue.length, hint: "lewat jadwal & belum selesai" },
          { label: "Selesai", value: items.filter((a) => a.status === "DONE").length, hint: `${items.length} activity total` },
        ]}
      />
      {view === "calendar" ? <ActivityCalendar items={items} /> : <ActivityList items={items} />}
    </div>
  );
}
