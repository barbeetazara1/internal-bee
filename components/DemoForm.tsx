import ClientPicker, { type ClientOpt } from "@/components/ClientPicker";
import DigitsInput from "@/components/DigitsInput";
import PhoneInput from "@/components/PhoneInput";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { RecordForm } from "@/components/Record";
import { saveDemo } from "@/app/actions/demo";
import { DEFAULT_DEMO_DAYS } from "@/lib/constants";

export type DemoFormValues = { id?: string; client_id?: string; product_id?: string; contact_name?: string; email?: string | null; phone?: string | null; demo_days?: number; notes?: string | null };
type Opt = { value: string; label: string };

/** Form permintaan demo: client memilih aplikasi (produk) yang ingin dicoba. */
export default function DemoForm({ d, clients, products, locked = false }: { d?: DemoFormValues; clients: ClientOpt[]; products: Opt[]; locked?: boolean }) {
  return (
    <RecordForm action={saveDemo} locked={locked} className="fields-compact">
      {d?.id && <input type="hidden" name="id" value={d.id} />}
      <Section title="Permintaan Demo" subtitle="Client, aplikasi yang ingin dicoba, dan lama demo">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <div className="space-y-2">
            <div><label className="label">Client<span className="text-red-500"> *</span></label><ClientPicker options={clients} defaultValue={d?.client_id ?? ""} /></div>
            <div><label className="label">Aplikasi<span className="text-red-500"> *</span></label><Select name="product_id" required searchable placeholder="Pilih produk…" options={products} defaultValue={d?.product_id ?? ""} /></div>
            <div>
              <label className="label">Lama demo (hari)</label>
              <DigitsInput name="demo_days" maxLength={2} required defaultValue={String(d?.demo_days ?? DEFAULT_DEMO_DAYS)} className="input" />
              <p className="mt-1 text-xs text-slate-400">License key demo bersifat sandbox dan otomatis berakhir setelah masa demo (1–90 hari).</p>
            </div>
          </div>
          <div className="space-y-2">
            <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required defaultValue={d?.contact_name ?? ""} className="input" /></div>
            <div><label className="label">Email</label><input name="email" type="email" defaultValue={d?.email ?? ""} className="input" /></div>
            <div><label className="label">Telepon</label><PhoneInput name="phone" defaultValue={d?.phone ?? ""} className="input" /></div>
          </div>
          <div className="md:col-span-2"><label className="label">Catatan</label><textarea name="notes" rows={2} defaultValue={d?.notes ?? ""} className="input" /></div>
        </div>
      </Section>
    </RecordForm>
  );
}
