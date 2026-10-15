import { RecordForm } from "@/components/Record";
import LicenseTypeField from "@/components/LicenseTypeField";
import MoneyInput from "@/components/MoneyInput";
import Section from "@/components/Section";
import { saveProduct } from "@/app/actions/products";

export type ProductFormValues = {
  id?: string; name?: string; code?: string; license_type?: string;
  base_price?: number; description?: string | null;
};

export default function ProductForm({ p }: { p?: ProductFormValues }) {
  return (
    <RecordForm action={saveProduct} className="fields-compact space-y-6">
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      <Section title="Informasi Produk" subtitle="Identitas dan penjelasan produk">
        <div className="space-y-2">
          <div><label className="label">Nama produk<span className="text-red-500"> *</span></label><input name="name" required defaultValue={p?.name} className="input" placeholder="Internal Bee OCR API" /></div>
          <div><label className="label">Kode produk<span className="text-red-500"> *</span></label><input name="code" required defaultValue={p?.code} className="input" placeholder="PROD-OCR-01" /></div>
          <div><label className="label">Deskripsi produk</label><textarea name="description" rows={3} defaultValue={p?.description ?? ""} className="input" /></div>
        </div>
      </Section>
      <Section title="Model Lisensi & Penetapan Harga" subtitle="Tipe lisensi dan harga produk">
        <LicenseTypeField license={p?.license_type ?? "YEARLY"}>
          <div><label className="label">Harga produk (IDR)</label><MoneyInput name="base_price" defaultValue={p?.base_price ?? 0} /></div>
        </LicenseTypeField>
      </Section>
    </RecordForm>
  );
}
