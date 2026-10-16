"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import Section from "./Section";
import ActivityDialog, { type ActivityInitial, type ActivityTypeOpt, type LocalActivity, type SalesOpt } from "./ActivityDialog";
import { useRecord } from "./Record";
import ActivityIcon from "./ActivityIcon";
import ActivityHistory from "./ActivityHistory";
import { Badge } from "./ui";
import { useLang } from "./I18nProvider";
import { confirmDialog } from "./confirm";
import { toast } from "./toast";
import { LEAD_LABEL } from "@/lib/constants";
import { ACTIVITY_STATE_LABEL, ACTIVITY_STATE_TONE, activityState, fmtWhen } from "@/lib/when";
import { deleteLeadActivities, setLeadActivityDone } from "@/app/actions/lead-activities";

export type LeadActivityDTO = { id: string; title: string; location: string | null; duration: number; sales: SalesOpt[]; type_id: string; type: string; icon: string; stage: string; scheduled_at: string; notes: string | null; status: string; by: string };

/** Section "Activity" di form lead: activity dikelompokkan per tahap lead; tambah, tandai selesai, hapus. */
export default function LeadActivities({ leadId, currentStage = "NEW", canAdd = true, types, items = [], history, salesUsers, leadSales = [] }: { leadId?: string; currentStage?: string; canAdd?: boolean; types: ActivityTypeOpt[]; items?: LeadActivityDTO[]; /** Activity tahap-tahap sebelumnya (kosong di form baru) → tombol History Activity di header, paling kanan */ history?: LeadActivityDTO[]; salesUsers: SalesOpt[]; leadSales?: SalesOpt[] }) {
  const { editing, extrasRef, formRef } = useRecord();
  // Form lead baru (leadId kosong): activity ditampung sebagai draft dan dikirim bersama Save.
  const draftMode = !leadId;
  const [drafts, setDrafts] = useState<(LocalActivity & { key: number })[]>([]);
  useEffect(() => {
    if (!draftMode) return;
    extrasRef.current.activities = () => JSON.stringify(drafts.map(({ type_id, title, scheduled_at, duration_minutes, sales_ids, location, notes }) => ({ type_id, title, scheduled_at, duration_minutes, sales_ids, location, notes })));
    return () => {
      delete extrasRef.current.activities;
    };
  }, [draftMode, drafts, extrasRef]);
  const router = useRouter();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ActivityInitial | undefined>(undefined); // activity yang sedang diedit (kosong = activity baru)
  const [, start] = useTransition();

  // Tahap saat ini dulu, lalu tahap lain mengikuti urutan pipeline; di dalam tahap: terjadwal terdekat dulu, selesai di bawah.
  const all: LeadActivityDTO[] = draftMode
    ? drafts.map((d) => ({ id: `draft-${d.key}`, title: d.title, location: d.location || null, duration: d.duration_minutes, sales: salesUsers.filter((u) => d.sales_ids.includes(u.id)), type_id: d.type_id, type: d.type, icon: d.icon, stage: "NEW", scheduled_at: d.scheduled_at, notes: d.notes || null, status: "PLANNED", by: "Anda" }))
    : items;
  // Hanya activity tahap saat ini: begitu lead pindah tahap, daftar mulai baru dan yang lama masuk "History Activity"
  const groups = useMemo(() => {
    const rows = all
      .filter((a) => a.stage === currentStage)
      .sort((a, b) => (a.status === b.status ? new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime() : a.status === "DONE" ? 1 : -1));
    return rows.length ? [{ stage: currentStage, rows }] : [];
  }, [all, currentStage]);

  const run = (fn: () => Promise<{ ok: boolean; message: string; changed?: boolean }>) =>
    start(async () => {
      const r = await fn();
      toast(r.message, !r.ok ? "error" : r.changed === false ? "info" : "success");
      router.refresh();
    });

  async function remove(a: LeadActivityDTO) {
    if (!(await confirmDialog({ title: "Hapus activity?", message: `Activity “${a.title}” akan dihapus dari lead ini.`, confirmLabel: "Hapus", danger: true }))) return;
    if (draftMode) return setDrafts((d) => d.filter((x) => `draft-${x.key}` !== a.id));
    run(() => deleteLeadActivities([a.id]));
  }

  // Sales person yang bisa dipilih di activity: yang tercatat pada lead (di form baru: yang sedang dipilih di field Sales Person)
  const [salesOpts, setSalesOpts] = useState<SalesOpt[]>(leadSales);
  const currentSales = (): SalesOpt[] => {
    if (!draftMode) return leadSales;
    const ids = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="sales_person_ids"]') ?? [])].map((i) => i.value);
    return salesUsers.filter((u) => ids.includes(u.id));
  };
  const openNew = () => {
    setSalesOpts(currentSales());
    setTarget(undefined);
    setOpen(true);
  };
  // Klik pada activity = membukanya (tanpa tombol). Hanya saat mode edit bisa diubah; selain itu hanya untuk dilihat.
  const canEditNow = editing && canAdd;
  const openEdit = (a: LeadActivityDTO) => {
    const key = a.id.startsWith("draft-") ? Number(a.id.slice(6)) : undefined;
    const draft = key === undefined ? undefined : drafts.find((d) => d.key === key);
    // Pilihan = sales person lead saat ini + yang sudah terpasang di activity ini (agar tetap terlihat)
    const opts = currentSales();
    setSalesOpts([...opts, ...a.sales.filter((p) => !opts.some((o) => o.id === p.id))]);
    setTarget({ id: key === undefined ? a.id : undefined, key, title: a.title, type_id: typeIdOf(a), scheduled_at: a.scheduled_at, duration: a.duration, sales_ids: draft ? draft.sales_ids : a.sales.map((p) => p.id), location: a.location ?? "", notes: a.notes ?? "", status: a.status });
    setOpen(true);
  };
  const typeIdOf = (a: LeadActivityDTO) => (draftMode ? drafts.find((d) => `draft-${d.key}` === a.id)!.type_id : a.type_id);

  return (
    <>
      <Section className="mt-6" title="Activity" subtitle="Aktivitas pada tahap lead saat ini — semua harus selesai sebelum pindah tahap" right={history ? <ActivityHistory compact items={history} /> : undefined} flush>
        {groups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">{canAdd ? (editing ? "Belum ada activity di tahap ini. Klik “+ Tambah Activity” untuk menjadwalkan yang pertama." : "Belum ada activity di tahap ini. Klik Ubah, lalu “+ Tambah Activity” untuk menjadwalkan.") : "Lead sudah ditutup. Activity tahap-tahap sebelumnya ada di History Activity."}</div>
        ) : (
          groups.map((g) => (
            <div key={g.stage} className="border-t border-slate-100 first:border-t-0">
              <div className="flex items-center gap-2 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {LEAD_LABEL[g.stage]}
                {g.stage === currentStage && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Tahap saat ini</span>}
                <span className="ml-auto font-normal text-slate-400">{g.rows.length}</span>
              </div>
              <ul className="space-y-2 p-3">
                {g.rows.map((a) => {
                  const st = activityState(a);
                  const late = st === "OVERDUE"; // lewat jadwal & belum selesai → merah; selain itu hijau
                  const canEdit = canEditNow;
                  return (
                    <li
                      key={a.id}
                      onClick={() => openEdit(a)}
                      title={canEdit ? "Klik untuk mengubah activity" : "Klik untuk melihat activity"}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${late ? "border-red-300 bg-red-500/10" : "border-emerald-300 bg-emerald-500/10"} cursor-pointer ${late ? "hover:border-red-400 hover:bg-red-500/15" : "hover:border-emerald-400 hover:bg-emerald-500/15"}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${late ? "bg-red-500/15 text-red-600" : "bg-emerald-500/15 text-emerald-600"}`}><ActivityIcon name={a.icon} /></span>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium ${st === "DONE" ? "text-slate-500 line-through" : ""}`}>{a.title}</div>
                        <div className="text-xs text-slate-500"><span data-no-i18n>{a.type} · {fmtWhen(a.scheduled_at, lang)}</span> · {`${a.duration} menit`}</div>
                        {a.location && <div className="mt-0.5 text-xs text-slate-500" data-no-i18n>📍 {a.location}</div>}
                        {a.sales.length > 0 && <div className="mt-0.5 text-xs text-slate-500" data-no-i18n>👤 {a.sales.map((p) => p.name).join(", ")}</div>}
                        {a.notes && <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{a.notes}</div>}
                      </div>
                      <Badge tone={ACTIVITY_STATE_TONE[st]}>{ACTIVITY_STATE_LABEL[st]}</Badge>
                      {canAdd && st !== "DONE" && (
                        <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {!draftMode && (
                            <button type="button" aria-label="Tandai selesai" title="Tandai selesai" onClick={() => run(() => setLeadActivityDone(a.id, true))} className="rounded p-1.5 text-slate-500 hover:bg-emerald-500/15 hover:text-emerald-600">
                              <Check size={15} />
                            </button>
                          )}
                          <button type="button" aria-label="Hapus activity" title="Hapus activity" onClick={() => remove(a)} className="rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-600"><Trash2 size={15} /></button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {/* Tombol tambah di bawah, seperti "Tambah Produk"; hanya muncul saat mode edit (form baru selalu mode edit) */}
        {canAdd && editing && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button type="button" className="btn btn-sm" onClick={openNew}>
              <Plus size={14} /> Tambah Activity
            </button>
            <span className="ml-3 text-xs text-slate-400">Klik activity untuk mengubahnya.{draftMode ? " Tersimpan bersama lead saat Save." : ""}</span>
          </div>
        )}
      </Section>
      <ActivityDialog
        open={open}
        onClose={() => setOpen(false)}
        types={types}
        leadId={leadId}
        stageLabel={LEAD_LABEL[currentStage]}
        initial={target}
        readOnly={!canEditNow}
        salesOptions={salesOpts}
        onLocalSave={
          draftMode
            ? (a, key) => setDrafts((d) => (key === undefined ? [...d, { ...a, key: Date.now() + d.length }] : d.map((x) => (x.key === key ? { ...a, key } : x))))
            : undefined
        }
      />
    </>
  );
}
