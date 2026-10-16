import Section from "./Section";
import Select from "./Select";
import ActivityIcon from "./ActivityIcon";
import { ACTIVITY_ICON_OPTIONS } from "@/lib/activity-types";

/** Field master Activity Type (dipakai form baru & detail). */
export default function ActivityTypeFields({ t }: { t?: { name: string; icon: string; sort: number; is_active: boolean; needs_location: boolean } }) {
  return (
    <Section title="Informasi Activity Type" subtitle="Nama, ikon, urutan tampil, dan statusnya">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        <div><label className="label">Nama<span className="text-red-500"> *</span></label><input name="name" required maxLength={60} defaultValue={t?.name} className="input" placeholder="Mis. Product Demo" /></div>
        <div>
          <label className="label">Ikon<span className="text-red-500"> *</span></label>
          <Select name="icon" required options={ACTIVITY_ICON_OPTIONS} defaultValue={t?.icon ?? "phone"} />
          {t && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><ActivityIcon name={t.icon} size={13} /> ikon saat ini tersimpan</div>}
        </div>
        <div><label className="label">Urutan</label><input name="sort" type="number" min={0} max={9999} defaultValue={t?.sort ?? 100} className="input" /></div>
        <div className="md:col-span-2"><label className="label">Butuh lokasi</label><Select name="needs_location" options={[{ value: "false", label: "Tidak" }, { value: "true", label: "Ya — activity wajib mengisi Lokasi detail" }]} defaultValue={t?.needs_location ? "true" : "false"} /></div>
        <div><label className="label">Status</label><Select name="is_active" options={[{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }]} defaultValue={t?.is_active === false ? "false" : "true"} /></div>
      </div>
    </Section>
  );
}
