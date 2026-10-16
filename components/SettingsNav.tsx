"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, Settings, Users, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { href: "/settings", label: "General", icon: Settings },
  { href: "/settings/activity-types", label: "Activity Types", icon: ListChecks, roles: ["SUPER_ADMIN"] },
  { href: "/settings/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN"] },
];

export default function SettingsNav({ role }: { role: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/settings" ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label="Settings" className="card w-52 shrink-0 self-stretch p-2">
      {ITEMS.filter((i) => !i.roles || i.roles.includes(role)).map((i) => (
        <Link key={i.href} href={i.href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${active(i.href) ? "bg-amber-50 font-medium text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}>
          <i.icon size={16} /> {i.label}
        </Link>
      ))}
    </nav>
  );
}
