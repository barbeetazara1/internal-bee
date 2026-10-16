"use client";

import { useMemo } from "react";
import DataTable, { type Col, type Row } from "./DataTable";
import ActivityIcon from "./ActivityIcon";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { LEAD_LABEL } from "@/lib/constants";
import { ACTIVITY_STATE_LABEL, ACTIVITY_STATE_TONE, activityState, fmtWhen } from "@/lib/when";
import { bulkSetActivityDone, deleteLeadActivities } from "@/app/actions/lead-activities";

export type ActivityRow = { id: string; title: string; location: string; duration: number; sales: string[]; type: string; icon: string; lead_id: string; lead: string; client: string; stage: string; scheduled_at: string; notes: string | null; status: string; by: string };

/** Daftar semua activity (menu Opportunities → Activity): dikelompokkan per lead; hanya melihat, tandai selesai, atau hapus massal. Activity dibuat dari form lead. */
export default function ActivityList({ items }: { items: ActivityRow[] }) {
  const { lang } = useLang();

  const columns: Col[] = [
    { key: "title", label: "Judul" },
    { key: "type", label: "Activity Type" },
    { key: "when", label: "Jadwal" },
    { key: "duration", label: "Durasi" },
    { key: "location", label: "Lokasi" },
    { key: "sales", label: "Sales Person" },
    { key: "client", label: "Client" },
    { key: "stage", label: "Tahap" },
    { key: "notes", label: "Catatan" },
    { key: "status", label: "Status" },
    { key: "by", label: "Dibuat oleh" },
  ];
  const rows: Row[] = useMemo(
    () =>
      items.map((a) => {
        const st = activityState(a);
        return {
          id: a.id,
          href: `/activities/${a.id}`,
          group: a.lead,
          cells: {
            title: { text: a.title, node: <span className="font-medium">{a.title}</span> },
            type: { text: a.type, node: <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ActivityIcon name={a.icon} size={14} /></span>{a.type}</span> },
            when: { text: fmtWhen(a.scheduled_at, lang) },
            duration: { text: `${a.duration} menit` },
            location: { text: a.location },
            sales: { text: a.sales.join(", ") },
            client: { text: a.client },
            stage: { text: LEAD_LABEL[a.stage] ?? a.stage },
            notes: { text: a.notes ?? "", node: <span className="line-clamp-2 max-w-xs text-xs text-slate-600">{a.notes}</span> },
            status: { text: ACTIVITY_STATE_LABEL[st], node: <Badge tone={ACTIVITY_STATE_TONE[st]}>{ACTIVITY_STATE_LABEL[st]}</Badge> },
            by: { text: a.by },
          },
        };
      }),
    [items, lang],
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        groupLabel="Lead"
        exportName="activities"
        searchPlaceholder="Cari judul, jenis, lead, client, catatan…"
        emptyText="Belum ada activity. Activity dibuat dari form lead (section Activity)."
        actions={[
          { label: "Tandai Selesai", run: bulkSetActivityDone.bind(null, true) },
          { label: "Kembalikan ke Terjadwal", run: bulkSetActivityDone.bind(null, false) },
          { label: "Delete", run: deleteLeadActivities, danger: true, confirm: "Delete {n} selected record(s)? This can't be undone." },
        ]}
      />
    </>
  );
}
