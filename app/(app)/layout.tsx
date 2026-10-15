import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import pkg from "@/package.json";
import { recordLink, type RecordType } from "@/lib/activity";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({ relationLoadStrategy: "join",
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    take: 20,
    include: { activity: { include: { author: { select: { name: true } } } } },
  });
  const notifications = rows.map((n) => ({
    id: n.id,
    read: !!n.read_at,
    author: n.activity.author.name,
    label: n.activity.record_label ?? "a record",
    snippet: n.activity.body ?? "",
    link: recordLink(n.activity.record_type as RecordType, n.activity.record_id),
    created_at: n.created_at.toISOString(),
  }));
  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} version={pkg.version} />
      <div className="app-content ml-60 print:ml-0">
        <Topbar user={{ name: user.name, email: user.email, role: user.role }} notifications={notifications} />
        <main className="p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
