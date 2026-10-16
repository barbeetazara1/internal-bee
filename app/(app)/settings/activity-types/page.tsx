import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import ActivityIcon from "@/components/ActivityIcon";
import { ACTIVITY_ICON_OPTIONS } from "@/lib/activity-types";
import { bulkActivityTypeActive, deleteActivityTypes } from "@/app/actions/activity-types";

export default async function ActivityTypesPage() {
  await requireRole("SUPER_ADMIN");
  const types = await prisma.activityType.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], include: { _count: { select: { activities: true } } } });
  const iconLabel = Object.fromEntries(ACTIVITY_ICON_OPTIONS.map((o) => [o.value, o.label]));
  const columns: Col[] = [
    { key: "name", label: "Activity Type" },
    { key: "icon", label: "Ikon" },
    { key: "loc", label: "Lokasi" },
    { key: "used", label: "Dipakai" },
    { key: "status", label: "Status" },
  ];
  const rows: Row[] = types.map((t) => ({
    id: t.id,
    href: `/settings/activity-types/${t.id}`,
    cells: {
      name: { text: t.name, node: <span className="flex items-center gap-2 font-medium"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ActivityIcon name={t.icon} size={14} /></span>{t.name}</span> },
      icon: { text: iconLabel[t.icon] ?? t.icon },
      loc: { text: t.needs_location ? "Wajib" : "—" },
      used: { text: `${t._count.activities} activity` },
      status: { text: t.is_active ? "Aktif" : "Nonaktif", node: t.is_active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge> },
    },
  }));
  return (
    <div>
      <PageHeader title="Activity Types" subtitle="Master data jenis activity yang bisa dipilih saat membuat activity pada lead">
        <CreateButton href="/settings/activity-types/new">Activity Type Baru</CreateButton>
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total Jenis", value: types.length, hint: `${types.filter((t) => t.is_active).length} aktif · ${types.filter((t) => !t.is_active).length} nonaktif` },
          { label: "Paling Sering Dipakai", value: [...types].sort((a, b) => b._count.activities - a._count.activities)[0]?._count.activities ? [...types].sort((a, b) => b._count.activities - a._count.activities)[0].name : "—", hint: "berdasarkan jumlah activity" },
          { label: "Total Activity", value: types.reduce((a, t) => a + t._count.activities, 0), hint: "pada semua lead" },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        exportName="activity-types"
        searchPlaceholder="Cari activity type…"
        emptyText="Belum ada activity type."
        actions={[
          { label: "Aktifkan", run: bulkActivityTypeActive.bind(null, true) },
          { label: "Nonaktifkan", run: bulkActivityTypeActive.bind(null, false) },
          { label: "Delete", run: deleteActivityTypes, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." },
        ]}
      />
    </div>
  );
}
