import Section from "./Section";

/** Tampilan "History & Comments" untuk record yang belum disimpan: tata letak sama, tapi masih kosong dan terkunci. */
export default function ChatterPlaceholder() {
  return (
    <div className="mt-6" role="region" aria-label="History and comments">
      <Section title="History & Comments" subtitle="Muncul setelah record disimpan" flush className="overflow-hidden">
        <div className="space-y-3 bg-slate-50 p-5">
          <p className="py-6 text-center text-sm text-slate-400">Belum ada riwayat. Pembuatan record dan setiap perubahannya akan tercatat di sini setelah Anda menekan Save.</p>
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-end gap-2">
            <textarea disabled rows={2} placeholder="Simpan record terlebih dahulu untuk menulis komentar" className="input resize-none opacity-60" />
            <button type="button" disabled className="btn btn-primary h-[54px]">Send</button>
          </div>
        </div>
      </Section>
    </div>
  );
}
