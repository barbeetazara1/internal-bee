"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveTask } from "@/app/actions/projects";
import { TASK_LABEL, TASK_STATUSES } from "@/lib/constants";
import type { TaskDTO, UserDTO } from "./task-types";

const PRIO: Record<string, string> = { HIGH: "bg-red-100 text-red-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-slate-100 text-slate-600" };
const COL: Record<string, string> = { TODO: "bg-slate-400", IN_PROGRESS: "bg-sky-500", IN_REVIEW: "bg-violet-500", DONE: "bg-emerald-500" };

export default function KanbanBoard({ projectId, tasks: initial, users, editable }: { projectId: string; tasks: TaskDTO[]; users: UserDTO[]; editable: boolean }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setTasks(initial), [initial]);
  const userName = (id: string | null) => users.find((u) => u.id === id)?.name;

  function move(id: string, status: string) {
    const t = tasks.find((x) => x.id === id);
    if (!editable || !t || t.status === status) return;
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    start(() => moveTask(id, status));
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-4">
        {TASK_STATUSES.map((s, si) => {
          const col = tasks.filter((t) => t.status === s);
          return (
            <div
              key={s}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); move(e.dataTransfer.getData("text/plain"), s); }}
              className={`min-h-48 rounded-xl border p-3 transition ${over === s ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-100/60"}`}
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2 w-2 rounded-full ${COL[s]}`} /> {TASK_LABEL[s]} <span className="ml-auto text-xs font-normal text-slate-400">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((t) => (
                  <div
                    key={t.id}
                    draggable={editable}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => router.push(`/projects/${projectId}/tasks/${t.id}`)}
                    className={`cursor-pointer rounded-lg border bg-surface p-3 shadow-sm transition hover:shadow border-slate-200 hover:border-amber-300`}
                  >
                    <div className="mb-2 text-sm font-medium leading-snug">{t.title}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${PRIO[t.priority]}`}>{t.priority}</span>
                      <span className="text-slate-400">{t.due_date.slice(5)}</span>
                    </div>
                    {userName(t.assignee_id) && <div className="mt-2 text-xs text-slate-500">👤 {userName(t.assignee_id)}</div>}
                    {editable && (
                      <div className="mt-2 flex justify-between" onClick={(e) => e.stopPropagation()}>
                        <button disabled={si === 0} className="btn btn-sm" onClick={() => move(t.id, TASK_STATUSES[si - 1])}>←</button>
                        <button disabled={si === 3} className="btn btn-sm" onClick={() => move(t.id, TASK_STATUSES[si + 1])}>→</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
