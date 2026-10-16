"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import DatePicker from "./DatePicker";
import Select from "./Select";
import MultiSelect from "./MultiSelect";
import NumericInput from "./NumericInput";
import { toast } from "./toast";
import { createLeadActivity, saveLeadActivity } from "@/app/actions/lead-activities";

export type ActivityTypeOpt = { id: string; name: string; icon: string; needs_location: boolean };

/** Activity yang ditampung lokal (form lead baru, lead belum tersimpan). `key` mengidentifikasi draft saat diedit. */
export type SalesOpt = { id: string; name: string };
export type LocalActivity = { type_id: string; title: string; type: string; icon: string; scheduled_at: string; duration_minutes: number; sales_ids: string[]; location: string; notes: string };

/** Nilai awal saat mengedit. `id` = activity tersimpan; `key` = draft lokal. */
export type ActivityInitial = { id?: string; key?: number; title: string; type_id: string; scheduled_at: string; duration: number; sales_ids: string[]; location: string; notes: string; status?: string };

/**
 * Modal activity: judul, jenis (master data), tanggal & waktu (satu widget), dan catatan tambahan (opsional).
 * Tanpa `initial` = activity baru; dengan `initial` = mengedit (activity tersimpan lewat `id`, atau draft lewat `key`).
 */
export default function ActivityDialog({
  open, onClose, types, leadId, stageLabel, initial, onLocalSave, readOnly = false, salesOptions,
}: {
  open: boolean; onClose: () => void; types: ActivityTypeOpt[]; leadId?: string; stageLabel?: string; initial?: ActivityInitial;
  /** Lead belum disimpan (form baru): activity ditampung lokal dan ikut tersimpan bersama lead saat Save. */
  onLocalSave?: (a: LocalActivity, key?: number) => void;
  /** Hanya melihat detail (di luar mode edit): semua field terkunci dan tidak ada tombol simpan. */
  readOnly?: boolean;
  /** Sales person yang bisa dipilih: hanya sales person yang terdaftar pada lead. */
  salesOptions: SalesOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("30");
  const [location, setLocation] = useState("");
  const [salesIds, setSalesIds] = useState<string[]>([]);
  const [seq, setSeq] = useState(0); // me-remount field saat dialog dibuka ulang
  const editing = !!initial;

  // Isi ulang field setiap dialog dibuka (kosong untuk baru, nilai activity untuk edit)
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setTypeId(initial?.type_id ?? "");
    setWhen(initial?.scheduled_at ?? "");
    setNotes(initial?.notes ?? "");
    setDuration(String(initial?.duration ?? 30));
    setLocation(initial?.location ?? "");
    setSalesIds(initial?.sales_ids ?? []);
    setError("");
    setSeq((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, initial?.key]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!title.trim()) return setError("Enter an activity title");
    if (!typeId) return setError("Choose an activity type");
    if (!when) return setError("Choose the activity date and time");
    const needsLoc = !!types.find((x) => x.id === typeId)?.needs_location;
    if (needsLoc && !location.trim()) return setError("Enter the activity location");
    const mins = Number(duration);
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) return setError("Duration must be between 1 and 1440 minutes");
    setError("");
    if (onLocalSave) {
      const t = types.find((x) => x.id === typeId)!;
      onLocalSave({ type_id: typeId, title: title.trim(), type: t.name, icon: t.icon, scheduled_at: when, duration_minutes: mins, sales_ids: salesIds, location: needsLoc ? location.trim() : "", notes: notes.trim() }, initial?.key);
      return onClose();
    }
    const fd = new FormData();
    if (initial?.id) fd.set("id", initial.id);
    else fd.set("lead_id", leadId ?? "");
    fd.set("title", title.trim());
    fd.set("type_id", typeId);
    fd.set("scheduled_at", when);
    fd.set("notes", notes);
    fd.set("duration_minutes", String(mins));
    fd.set("location", needsLoc ? location.trim() : "");
    for (const sid of salesIds) fd.append("sales_person_ids", sid);
    start(async () => {
      const r = await (initial?.id ? saveLeadActivity(fd) : createLeadActivity(fd));
      if (!r.ok) return setError(r.message);
      toast(r.message, r.changed === false ? "info" : "success");
      onClose();
      router.refresh();
    });
  }

  if (!open) return null;
  const label = readOnly ? "Detail Activity" : editing ? "Ubah Activity" : "Activity Baru";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={label} className={`card fields-compact w-full max-w-lg p-0 shadow-2xl ${readOnly ? "record-view [&_.text-red-500]:hidden" : ""}`}>
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{label}</h2>
          {stageLabel && <p className="mt-1 text-sm text-slate-500">{editing ? <>Tahap lead saat ini: <b className="text-slate-800">{stageLabel}</b>.</> : <>Dicatat pada tahap <b className="text-slate-800">{stageLabel}</b>.</>}</p>}
        </div>
        <div className="space-y-3 px-6 py-5">
          <div>
            <label className="label">Judul Activity<span className="text-red-500"> *</span></label>
            <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mis. Demo OCR untuk tim IT" autoFocus={!readOnly} disabled={readOnly} />
          </div>
          <div>
            <label className="label">Activity Type<span className="text-red-500"> *</span></label>
            <Select key={`t${seq}`} options={types.map((t) => ({ value: t.id, label: t.name }))} defaultValue={typeId} placeholder="Pilih jenis activity…" onChange={setTypeId} locked={readOnly} />
          </div>
          {types.find((x) => x.id === typeId)?.needs_location && (
            <div>
              <label className="label">Lokasi Detail<span className="text-red-500"> *</span></label>
              <input className="input" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mis. Kantor client, Jl. Sudirman 12 / Zoom" disabled={readOnly} />
            </div>
          )}
          <div className="grid grid-cols-[1fr_9.5rem] gap-3">
            <div className="flex flex-col justify-end">
              <label className="label">Tanggal &amp; Waktu<span className="text-red-500"> *</span></label>
              <DatePicker key={`d${seq}`} time required value={when} onChange={setWhen} locked={readOnly} />
            </div>
            <div className="flex flex-col justify-end">
              <label className="label whitespace-nowrap">Durasi (menit)<span className="text-red-500"> *</span></label>
              <NumericInput maxDigits={4} value={duration} onChange={setDuration} disabled={readOnly} placeholder="30" />
            </div>
          </div>
          <div>
            <label className="label">Sales Person</label>
            <MultiSelect key={`m${seq}`} options={salesOptions.map((u) => ({ value: u.id, label: u.name }))} value={salesIds} onChange={setSalesIds} placeholder={salesOptions.length ? "Pilih sales person…" : "Lead ini belum punya sales person"} emptyText="Lead ini belum punya sales person" locked={readOnly} />
          </div>
          <div>
            <label className="label">Catatan tambahan {!readOnly && <span className="font-normal text-slate-400">(opsional)</span>}</label>
            <textarea rows={3} maxLength={2000} className="input" value={readOnly && !notes ? "—" : notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mis. bahas kebutuhan integrasi, siapkan demo sandbox…" disabled={readOnly} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" className="btn" disabled={pending} onClick={onClose}>{readOnly ? "Tutup" : "Batal"}</button>
          {!readOnly && <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Simpan Activity"}</button>}
        </div>
      </form>
    </div>,
    document.body,
  );
}
