import { fillTemplate, resolveTemplate } from "@/lib/proposal-template";
import { fmtDate, idr } from "@/lib/format";

export type ProposalData = {
  number: string;
  date: Date;
  lead: string;
  client: string;
  contact: string;
  email: string;
  phone: string;
  owner: string;
  lines: { name: string; license: string; price: number }[];
  /** Add-on lead (hosting, domain, …); `billed` = false bila dikelola client */
  addons?: { name: string; billing: string; periods: string; unit: number; subtotal: number; billed: boolean }[];
};

/** Dokumen proposal siap cetak (A4). Teks mengikuti template di Settings → Proposal; tabel produk & total diambil dari lead. */
export default function ProposalDocument({ data, template }: { data: ProposalData; template: ReturnType<typeof resolveTemplate> }) {
  const t = template;
  const addons = data.addons ?? [];
  const productTotal = data.lines.reduce((a, l) => a + l.price, 0);
  const addonTotal = addons.filter((x) => x.billed).reduce((a, x) => a + x.subtotal, 0);
  const total = productTotal + addonTotal;
  const valid = new Date(data.date.getTime() + t.validity_days * 86400000);
  const vars = { client: data.client, contact: data.contact || data.client, lead: data.lead, company: t.company_name, owner: data.owner, date: fmtDate(data.date), valid_until: fmtDate(valid), total: idr(total) };
  const f = (s: string) => fillTemplate(s, vars);
  const terms = f(t.terms).split("\n").map((x) => x.trim()).filter(Boolean);
  const signer = t.signer_name || data.owner;
  return (
    <article data-no-i18n className="doc-light mx-auto max-w-[210mm] rounded-xl border border-slate-200 bg-white p-12 text-[15px] leading-relaxed text-slate-800 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-amber-400 pb-5">
        <div>
          <div className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900"><span aria-hidden>🐝</span>{t.company_name}</div>
          <div className="text-sm text-slate-500">{t.tagline}</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-xl font-bold uppercase tracking-[0.18em] text-slate-900">{t.title}</div>
          <div className="mt-1 text-slate-500">No. {data.number}</div>
          <div className="text-slate-500">{fmtDate(data.date)}</div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kepada</div>
          <div className="text-base font-semibold text-slate-900">{data.client}</div>
          {data.contact && <div>{data.contact}</div>}
          <div className="text-slate-500">{[data.email, data.phone].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perihal</div>
          <div className="font-semibold text-slate-900">{data.lead}</div>
          <div className="text-slate-500">Berlaku sampai {fmtDate(valid)}</div>
        </div>
      </section>

      <div className="mt-6 whitespace-pre-line">{f(t.intro)}</div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="w-10 px-3 py-2">No</th><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Lisensi</th><th className="px-3 py-2 text-right">Harga</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada produk pada lead ini.</td></tr>}
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="px-3 py-2.5 text-slate-500">{i + 1}</td><td className="px-3 py-2.5 font-medium">{l.name}</td><td className="px-3 py-2.5">{l.license}</td><td className="px-3 py-2.5 text-right tabular-nums">{idr(l.price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold uppercase tracking-wide text-slate-500">{addons.length > 0 ? "Total Produk" : "Total"}</td><td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-slate-900">{idr(productTotal)}</td></tr>
        </tfoot>
      </table>

      {addons.length > 0 && (
        <table className="mt-6 w-full border-collapse text-sm">
          <caption className="mb-1 text-left text-sm font-bold uppercase tracking-wide text-slate-900">Add-on &amp; Layanan Tambahan</caption>
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-3 py-2">No</th><th className="px-3 py-2">Add-on</th><th className="px-3 py-2">Penagihan</th><th className="px-3 py-2 text-right">Harga / periode</th><th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {addons.map((x, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="px-3 py-2.5 text-slate-500">{i + 1}</td><td className="px-3 py-2.5 font-medium">{x.name}</td>
                <td className="px-3 py-2.5">{x.billed ? `${x.billing}${x.periods ? ` · ${x.periods}` : ""}` : "Disediakan client"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{x.billed ? idr(x.unit) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{x.billed ? idr(x.subtotal) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold uppercase tracking-wide text-slate-500">Total Add-on</td><td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-slate-900">{idr(addonTotal)}</td></tr>
          </tfoot>
        </table>
      )}

      {addons.length > 0 && (
        <section className="mt-4 ml-auto w-full max-w-sm break-inside-avoid rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Total Produk</span><span className="tabular-nums">{idr(productTotal)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Total Add-on</span><span className="tabular-nums">{idr(addonTotal)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900"><span>Total Keseluruhan</span><span className="tabular-nums">{idr(total)}</span></div>
        </section>
      )}

      {f(t.scope) && (
        <section className="mt-6">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-900">Ruang Lingkup</h3>
          <p className="whitespace-pre-line">{f(t.scope)}</p>
        </section>
      )}
      {terms.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-900">Syarat &amp; Ketentuan</h3>
          <ol className="list-decimal space-y-0.5 pl-5">{terms.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </section>
      )}

      <p className="mt-6 whitespace-pre-line">{f(t.closing)}</p>

      <section className="mt-10 break-inside-avoid">
        <div>Hormat kami,</div>
        <div className="mt-16 border-t border-slate-400 pt-1 font-semibold text-slate-900" style={{ width: "14rem" }}>{signer}</div>
        <div className="text-sm text-slate-500">{t.signer_title}{t.signer_title ? " · " : ""}{t.company_name}</div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">{f(t.footer)}</footer>
    </article>
  );
}
