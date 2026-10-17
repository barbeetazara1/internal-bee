import Section from "./Section";
import Select from "./Select";
import MoneyInput from "./MoneyInput";
import AddonBillingField from "./AddonBillingField";
import { ADDON_KIND_OPTIONS } from "@/lib/addons";

/** Field master Add-on (dipakai form baru & detail). */
export default function AddonFields({ a }: { a?: { name: string; kind: string; billing: string; price: number; description: string | null; sort: number } }) {
  return (
    <Section title="Informasi Add-on" subtitle="Biaya tambahan di luar produk, mis. hosting, domain, SSL">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        <div className="md:col-span-2"><label className="label">Nama<span className="text-red-500"> *</span></label><input name="name" required maxLength={80} defaultValue={a?.name} className="input" placeholder="Mis. Cloud Hosting Standard" /></div>
        <div><label className="label">Jenis<span className="text-red-500"> *</span></label><Select name="kind" required options={ADDON_KIND_OPTIONS} defaultValue={a?.kind ?? "HOSTING"} /></div>
        <div className="md:col-span-2 mb-2"><AddonBillingField billing={a?.billing ?? "MONTHLY"} /></div>
        <div><label className="label">Harga default (IDR per periode)</label><MoneyInput name="price" defaultValue={a?.price ?? 0} /></div>
        <div><label className="label">Urutan</label><input name="sort" type="number" min={0} max={9999} defaultValue={a?.sort ?? 100} className="input" /></div>
        <div className="md:col-span-2"><label className="label">Deskripsi</label><textarea name="description" rows={3} maxLength={500} defaultValue={a?.description ?? ""} className="input" placeholder="Mis. 2 vCPU, 4 GB RAM, 80 GB SSD" /></div>
      </div>
    </Section>
  );
}
