"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Columns3, List } from "lucide-react";

export type ViewMode = "list" | "kanban" | "calendar";
const META: Record<ViewMode, { label: string; Icon: typeof List }> = { list: { label: "List", Icon: List }, kanban: { label: "Kanban", Icon: Columns3 }, calendar: { label: "Calendar", Icon: CalendarDays } };

/** Toggle tampilan (List / Kanban / Calendar). Pilihan dibawa lewat URL (?view=). */
export default function ViewToggle({ base, current, modes = ["list", "kanban"] }: { base: string; current: ViewMode; modes?: ViewMode[] }) {
  const router = useRouter();
  const go = (v: ViewMode) => {
    if (v === current) return;
    router.push(`${base}?view=${v}`);
  };
  const item = (v: ViewMode) => {
    const { label, Icon } = META[v];
    return (
    <button
      key={v}
      type="button"
      role="radio"
      aria-checked={current === v}
      aria-label={label}
      title={label}
      onClick={() => go(v)}
      className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${current === v ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
    >
      <Icon size={15} /> {label}
    </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Tampilan" className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      {modes.map((m) => item(m))}
    </div>
  );
}
