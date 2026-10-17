"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import Section from "./Section";
import Select from "./Select";
import MoneyInput from "./MoneyInput";
import NumericInput from "./NumericInput";
import { useRecord } from "./Record";
import { ADDON_BILLING_LABEL, ADDON_BILLING_OPTIONS, ADDON_DEFAULT_PERIODS, ADDON_MAX_PERIODS, ADDON_PERIOD_UNIT } from "@/lib/addons";
import { idr } from "@/lib/format";

export type AddonOpt = { value: string; label: string; price: number; billing: string };
export type LeadAddonInit = { id: string; addon_id: string; price: number; billing: string; periods: number; quantity: number; client_managed: boolean; product_id: string | null };
type Line = { key: string; id?: string; addon_id: string; price: number; billing: string; periods: number; quantity: number; client_managed: boolean; product_id: string };

const fromInit = (l: LeadAddonInit): Line => ({ key: l.id, id: l.id, addon_id: l.addon_id, price: l.price, billing: l.billing, periods: l.periods, quantity: l.quantity, client_managed: l.client_managed, product_id: l.product_id ?? "" });
let seq = 0;

/**
 * Add-on pada lead (hosting, domain, SSL, …): dipasang per lead, bukan per produk, supaya hosting tidak tertagih ganda.
 * "Dikelola client" = client punya sendiri: dicatat tetapi tidak ditagih. Tersimpan bersama tombol Save (field `addons`).
 */
export default function LeadAddons({ initial, addons, products, locked }: { initial: LeadAddonInit[]; addons: AddonOpt[]; products: { value: string; label: string }[]; locked: boolean }) {
  const { editing, extrasRef, discardCount } = useRecord();
  const [lines, setLines] = useState<Line[]>(() => initial.map(fromInit));
  const ref = useRef(lines);
  ref.current = lines;
  const canEdit = editing && !locked;

  useEffect(() => {
    if (locked) return;
    extrasRef.current.addons = () => JSON.stringify(ref.current.map((l) => ({ id: l.id, addon_id: l.addon_id, price: l.price, billing: l.billing, periods: l.periods, quantity: l.quantity, client_managed: l.client_managed, product_id: l.product_id || null })));
    return () => {
      delete extrasRef.current.addons;
    };
  }, [extrasRef, locked]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLines(initial.map(fromInit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardCount]);

  const meta = (id: string) => addons.find((a) => a.value === id);
  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (key: string, id: string) => {
    const m = meta(id);
    const billing = m?.billing ?? "MONTHLY";
    set(key, { addon_id: id, price: m?.price ?? 0, billing, periods: ADDON_DEFAULT_PERIODS[billing] ?? 1 });
  };
  const used = new Set(lines.map((l) => l.addon_id));
  const sub = (l: Line) => l.price * l.quantity * (l.billing === "ONE_TIME" ? 1 : l.periods);
  const billed = lines.filter((l) => !l.client_managed);
  const total = billed.reduce((a, l) => a + sub(l), 0);
  const scopeOpts = [{ value: "", label: "Semua produk" }, ...products];
  const scopeLabel = (id: string) => scopeOpts.find((o) => o.value === id)?.label ?? "Semua produk";
  const periodText = (l: Line) => (l.billing === "ONE_TIME" ? "—" : `${l.periods} ${ADDON_PERIOD_UNIT[l.billing]}`);

  return (
    <Section
      title="Add-ons"
      subtitle={locked ? "Terkunci karena lead sudah ditutup." : "Biaya tambahan di luar produk (hosting, domain, SSL, …) — ditagih berulang sesuai periodenya setelah Closed Won"}
      flush
      right={<div className="text-sm text-slate-500">Total tagihan add-on: <b className="text-slate-900">{idr(total)}</b></div>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Add-on</th><th className="th">Berlaku untuk</th><th className="th">Expected Price</th><th className="th">Harga / Periode</th><th className="th">Qty</th>
              <th className="th">Periode Tagih</th><th className="th">Lama</th><th className="th">Dikelola Client</th><th className="th text-right">Subtotal</th>
              {canEdit && <th className="th w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">{canEdit ? "Belum ada add-on. Klik “Tambah Add-on” bila client butuh hosting, domain, dsb." : "Belum ada add-on."}</td></tr>}
            {lines.map((l) => {
              const m = meta(l.addon_id);
              const k = `${l.key}-${discardCount}`;
              return (
                <tr key={k} className={l.client_managed ? "bg-slate-50/60" : ""}>
                  {canEdit ? (
                    <>
                      <td className="td min-w-56"><Select placeholder="Pilih add-on…" options={addons.filter((a) => a.value === l.addon_id || !used.has(a.value))} defaultValue={l.addon_id} onChange={(v) => pick(l.key, v)} /></td>
                      <td className="td min-w-44"><Select options={scopeOpts} defaultValue={l.product_id} onChange={(v) => set(l.key, { product_id: v })} /></td>
                      <td className="td whitespace-nowrap text-slate-500" title="Harga dari katalog add-on (hanya baca)">{m ? idr(m.price) : "—"}</td>
                      <td className="td min-w-40"><MoneyInput key={`${k}-${l.addon_id}`} defaultValue={l.price} onChange={(d) => set(l.key, { price: Number(d || 0) })} /></td>
                      <td className="td w-20"><NumericInput maxDigits={3} value={String(l.quantity)} onChange={(v) => set(l.key, { quantity: Math.max(1, Number(v || 1)) })} /></td>
                      <td className="td min-w-36"><Select key={`${k}-${l.addon_id}`} options={ADDON_BILLING_OPTIONS} defaultValue={l.billing} onChange={(v) => set(l.key, { billing: v, periods: ADDON_DEFAULT_PERIODS[v] ?? 1 })} /></td>
                      <td className="td w-28">
                        {l.billing === "ONE_TIME" ? <span className="text-slate-400">—</span> : (
                          <div className="flex items-center gap-1.5"><NumericInput maxDigits={2} value={String(l.periods)} onChange={(v) => set(l.key, { periods: Math.min(ADDON_MAX_PERIODS, Math.max(1, Number(v || 1))) })} /><span className="text-xs text-slate-500">{ADDON_PERIOD_UNIT[l.billing]}</span></div>
                        )}
                      </td>
                      <td className="td"><input type="checkbox" aria-label="Dikelola client" checked={l.client_managed} onChange={(e) => set(l.key, { client_managed: e.target.checked })} className="h-4 w-4 accent-amber-500" /></td>
                    </>
                  ) : (
                    <>
                      <td className="td font-medium">{m?.label ?? "—"}</td>
                      <td className="td">{scopeLabel(l.product_id)}</td>
                      <td className="td whitespace-nowrap text-slate-500" title="Harga dari katalog add-on (hanya baca)">{m ? idr(m.price) : "—"}</td>
                      <td className="td whitespace-nowrap">{idr(l.price)}</td>
                      <td className="td">{l.quantity}</td>
                      <td className="td">{ADDON_BILLING_LABEL[l.billing] ?? l.billing}</td>
                      <td className="td">{periodText(l)}</td>
                      <td className="td">{l.client_managed ? "Ya" : "—"}</td>
                    </>
                  )}
                  <td className="td whitespace-nowrap text-right font-medium">{l.client_managed ? <span className="text-xs font-normal text-slate-400">Disediakan client</span> : idr(sub(l))}</td>
                  {canEdit && <td className="td"><button type="button" aria-label="Hapus add-on" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button type="button" className="btn btn-sm" disabled={used.size >= addons.length} onClick={() => setLines((ls) => [...ls, { key: `new-${++seq}`, addon_id: "", price: 0, billing: "MONTHLY", periods: 12, quantity: 1, client_managed: false, product_id: "" }])}>
            <Plus size={14} /> Tambah Add-on
          </button>
          <span className="ml-3 text-xs text-slate-400">Perubahan baru tersimpan setelah menekan Save. Centang “Dikelola Client” bila client sudah punya server/domain sendiri (tidak ditagih).</span>
        </div>
      )}
    </Section>
  );
}
