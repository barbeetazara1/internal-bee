import DigitsInput from "@/components/DigitsInput";
import PhoneInput from "@/components/PhoneInput";
import Section from "@/components/Section";
import { RecordForm } from "@/components/Record";
import { saveClient } from "@/app/actions/clients";

export type ClientFormValues = { id?: string; name?: string; code?: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; country?: string | null; province?: string | null; city?: string | null; district?: string | null; postal_code?: string | null };

export default function ClientForm({ c }: { c?: ClientFormValues }) {
  return (
    <RecordForm action={saveClient} className="fields-compact space-y-6">
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      <Section title="Informasi Perusahaan" subtitle="Nama dan kode client">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <div><label className="label">Nama perusahaan<span className="text-red-500"> *</span></label><input name="name" required defaultValue={c?.name} className="input" placeholder="PT Contoh Sejahtera" /></div>
          {c?.code && <div><label className="label">Kode client</label><input value={c.code} readOnly disabled className="input font-mono" /></div>}
        </div>
      </Section>
      <Section title="Kontak" subtitle="Penanggung jawab di sisi client">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
          <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required defaultValue={c?.contact_name ?? ""} className="input" /></div>
          <div><label className="label">Email<span className="text-red-500"> *</span></label><input name="email" type="email" required defaultValue={c?.email ?? ""} className="input" /></div>
          <div><label className="label">Telepon<span className="text-red-500"> *</span></label><PhoneInput name="phone" required defaultValue={c?.phone ?? ""} className="input" /></div>
        </div>
      </Section>
      <Section title="Alamat" subtitle="Lokasi perusahaan client">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <div className="space-y-2">
            <div><label className="label">Negara</label><input name="country" defaultValue={c ? (c.country ?? "") : "Indonesia"} className="input" /></div>
            <div><label className="label">Provinsi</label><input name="province" defaultValue={c?.province ?? ""} className="input" /></div>
            <div><label className="label">Kota</label><input name="city" defaultValue={c?.city ?? ""} className="input" /></div>
          </div>
          <div className="space-y-2">
            <div><label className="label">Kecamatan/Kelurahan</label><input name="district" defaultValue={c?.district ?? ""} className="input" /></div>
            <div><label className="label">Kode Pos</label><DigitsInput name="postal_code" defaultValue={c?.postal_code ?? ""} className="input" /></div>
          </div>
          <div className="md:col-span-2"><label className="label">Alamat lengkap<span className="text-red-500"> *</span></label><textarea name="address" rows={2} required defaultValue={c?.address ?? ""} className="input" /></div>
        </div>
      </Section>
    </RecordForm>
  );
}
