import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ActivityTypeFields from "@/components/ActivityTypeFields";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { saveActivityType } from "@/app/actions/activity-types";

export default async function ActivityTypeDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const t = await prisma.activityType.findUnique({ where: { id }, include: { _count: { select: { activities: true } } } });
  if (!t) notFound();
  return (
    <RecordProvider listHref="/settings/activity-types">
      <div>
        <Breadcrumb items={[{ label: "Activity Types", href: "/settings/activity-types" }, { label: t.name }]} />
        <PageHeader title={t.name} subtitle={`${t._count.activities} activity memakai jenis ini`} />
        <RecordBar createHref="/settings/activity-types/new" />
        <RecordForm action={saveActivityType} className="fields-compact space-y-6">
          <input type="hidden" name="id" value={t.id} />
          <ActivityTypeFields t={{ name: t.name, icon: t.icon, sort: t.sort, is_active: t.is_active, needs_location: t.needs_location }} />
        </RecordForm>
      </div>
    </RecordProvider>
  );
}
