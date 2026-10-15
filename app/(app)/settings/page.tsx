import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import LanguageSettings from "@/components/LanguageSettings";

export default async function GeneralSettings() {
  await requireUser();
  return (
    <div>
      <PageHeader title="General Settings" subtitle="Preferensi umum aplikasi" />
      <div className="space-y-6">
        <LanguageSettings />
      </div>
    </div>
  );
}
