"use client";

import Link from "next/link";
import ActivityIcon from "./ActivityIcon";
import Section from "./Section";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { LEAD_LABEL } from "@/lib/constants";
import { ACTIVITY_STATE_LABEL, ACTIVITY_STATE_TONE, activityState, fmtWhen } from "@/lib/when";

export type ClientActivityDTO = { id: string; title: string; location: string | null; duration: number; type: string; icon: string; lead_id: string; lead: string; stage: string; scheduled_at: string; notes: string | null; status: string };

/** Section "Activity" di detail Client: activity dari semua lead milik client ini (terjadwal terdekat dulu, lalu yang selesai). */
export default function ClientActivities({ items }: { items: ClientActivityDTO[] }) {
  const { lang } = useLang();
  const rows = [...items]
    .sort((a, b) => (a.status === b.status ? (a.status === "DONE" ? new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime() : new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) : a.status === "DONE" ? 1 : -1))
    .slice(0, 12);
  const planned = items.filter((a) => a.status !== "DONE").length;
  return (
    <Section className="mt-6" title="Activity" subtitle={`${planned} terjadwal · ${items.length} total dari semua lead`} flush>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">Belum ada activity pada lead client ini.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((a) => {
            const st = activityState(a);
            return (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ActivityIcon name={a.icon} /></span>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${st === "DONE" ? "text-slate-400 line-through" : ""}`}>{a.title}</div>
                  <div className="text-xs text-slate-500">
                    <span data-no-i18n>{a.type} · {fmtWhen(a.scheduled_at, lang)}</span> · {`${a.duration} menit`}{a.location ? <span data-no-i18n> · 📍 {a.location}</span> : null} · <Link href={`/leads/${a.lead_id}`} className="hover:underline">{a.lead}</Link> · {LEAD_LABEL[a.stage]}
                  </div>
                  {a.notes && <div className="mt-1 line-clamp-2 text-xs text-slate-600">{a.notes}</div>}
                </div>
                <Badge tone={ACTIVITY_STATE_TONE[st]}>{ACTIVITY_STATE_LABEL[st]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
