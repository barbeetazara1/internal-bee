import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ActivityTypeFields from "@/components/ActivityTypeFields";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import { createActivityType } from "@/app/actions/activity-types";

export default async function NewActivityType() {
  await requireRole("SUPER_ADMIN");
  return (
    <RecordProvider isNew listHref="/settings/activity-types">
      <div>
        <Breadcrumb items={[{ label: "Activity Types", href: "/settings/activity-types" }, { label: "Activity Type Baru" }]} />
        <PageHeader title="Activity Type Baru" subtitle="Tambah jenis activity yang bisa dipilih pada lead" />
        <RecordBar />
        <RecordForm action={createActivityType} className="fields-compact space-y-6">
          <ActivityTypeFields />
        </RecordForm>
        <ChatterPlaceholder />
      </div>
    </RecordProvider>
  );
}
