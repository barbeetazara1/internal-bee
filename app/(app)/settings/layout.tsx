import { requireUser } from "@/lib/auth";
import SettingsNav from "@/components/SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-[calc(100vh-3.5rem-4rem)] items-stretch gap-6">
      <SettingsNav role={user.role} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
