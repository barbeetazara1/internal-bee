"use client";

import { useRouter } from "next/navigation";
import { Columns3, List } from "lucide-react";

/** Toggle tampilan List / Kanban. Pilihan dibawa lewat URL (?view=). */
export default function ViewToggle({ base, current }: { base: string; current: "list" | "kanban" }) {
  const router = useRouter();
  const go = (v: "list" | "kanban") => {
    if (v === current) return;
    router.push(`${base}?view=${v}`);
  };
  const item = (v: "list" | "kanban", label: string, Icon: typeof List) => (
    <button
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
  return (
    <div role="radiogroup" aria-label="Tampilan" className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      {item("list", "List", List)}
      {item("kanban", "Kanban", Columns3)}
    </div>
  );
}
