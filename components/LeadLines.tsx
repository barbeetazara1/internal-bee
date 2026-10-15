"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import Section from "./Section";
import Select, { type Opt } from "./Select";
import { StatusBadge } from "./ui";
import { useRecord } from "./Record";
import MoneyInput from "./MoneyInput";
import { ENV_OPTIONS, LICENSE_LABEL, LICENSE_TYPES } from "@/lib/constants";
import { idr } from "@/lib/format";

/** Produk yang bisa dipilih + data dari katalog (harga, tipe lisensi, skema tagihan) yang diturunkan otomatis. */
export type ProductOpt = Opt & { price: number; license_type: string };
export type LineInit = { id: string; product_id: string; price: number; environment: string; license_type: string };
type Line = { key: string; id?: string; product_id: string; price: number; environment: string; license_type: string };

const fromInit = (l: LineInit): Line => ({ key: l.id, id: l.id, product_id: l.product_id, price: l.price, environment: l.environment, license_type: l.license_type });
const LICENSE_OPTS = LICENSE_TYPES.map((v) => ({ value: v, label: LICENSE_LABEL[v] }));
let seq = 0;

/**
 * Baris produk pada lead. Memilih produk mengisi harga, tipe lisensi, dan skema tagihan dari katalog sebagai nilai awal;
 * ketiganya tetap bisa diubah per lead (mis. saat client mengubah kebutuhan).
 * Bagian dari form utama: perubahan tersimpan saat Save (dikirim sebagai field `lines`), Discard mengembalikannya.
 */
export default function LeadLines({ initial, products, locked, lockedNote }: { initial: LineInit[]; products: ProductOpt[]; locked: boolean; lockedNote?: string }) {
  const { editing, extrasRef, discardCount } = useRecord();
  const [lines, setLines] = useState<Line[]>(() => initial.map(fromInit));
  const ref = useRef(lines);
  ref.current = lines;
  const canEdit = editing && !locked;

  useEffect(() => {
    if (locked) return;
    extrasRef.current.lines = () => JSON.stringify(ref.current.map((l) => ({ id: l.id, product_id: l.product_id, environment: l.environment, price: l.price, license_type: l.license_type })));
    return () => {
      delete extrasRef.current.lines;
    };
  }, [extrasRef, locked]);

  // Discard → kembali ke data tersimpan.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLines(initial.map(fromInit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardCount]);

  const meta = (id: string) => products.find((p) => p.value === id);
  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (key: string, id: string) => {
    const m = meta(id); // nilai awal dari katalog
    set(key, { product_id: id, price: m?.price ?? 0, license_type: m?.license_type ?? "YEARLY" });
  };
  const used = new Set(lines.map((l) => l.product_id));
  const total = lines.reduce((a, l) => a + l.price, 0);

  return (
    <Section
      title="Produk yang Diminati"
      subtitle={locked && lockedNote ? lockedNote : "Harga dan tipe lisensi terisi dari katalog produk dan bisa disesuaikan"}
      flush
      right={<div className="text-sm text-slate-500">Total: <b className="text-slate-900">{idr(total)}</b></div>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Produk</th><th className="th">Tipe Lisensi</th><th className="th">Harga</th><th className="th">Env</th>
              {canEdit && <th className="th w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">{canEdit ? "Belum ada produk. Klik “Tambah Produk”." : "Belum ada produk."}</td></tr>
            )}
            {lines.map((l) => {
              const m = meta(l.product_id);
              return (
                <tr key={`${l.key}-${discardCount}`}>
                  {canEdit ? (
                    <td className="td min-w-72">
                      <Select placeholder="Pilih produk…" options={products.filter((p) => p.value === l.product_id || !used.has(p.value))} defaultValue={l.product_id} onChange={(v) => pick(l.key, v)} />
                    </td>
                  ) : (
                    <td className="td font-medium">{m?.label ?? "—"}</td>
                  )}
                  {canEdit ? (
                    <>
                      <td className="td min-w-40"><Select key={`${l.key}-${l.product_id}`} options={LICENSE_OPTS} defaultValue={l.license_type} onChange={(v) => set(l.key, { license_type: v })} /></td>
                      <td className="td min-w-44"><MoneyInput key={`${l.key}-${l.product_id}`} defaultValue={l.price} onChange={(d) => set(l.key, { price: Number(d || 0) })} /></td>
                    </>
                  ) : (
                    <>
                      <td className="td">{m ? LICENSE_LABEL[l.license_type] ?? l.license_type : "—"}</td>
                      <td className="td font-medium">{m || l.price ? idr(l.price) : "—"}</td>
                    </>
                  )}
                  {canEdit ? (
                    <td className="td min-w-40"><Select options={ENV_OPTIONS} defaultValue={l.environment} onChange={(v) => set(l.key, { environment: v })} /></td>
                  ) : (
                    <td className="td"><StatusBadge status={l.environment} /></td>
                  )}
                  {canEdit && (
                    <td className="td"><button type="button" aria-label="Hapus produk" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            type="button"
            className="btn btn-sm"
            disabled={used.size >= products.length}
            onClick={() => setLines((ls) => [...ls, { key: `new-${++seq}`, product_id: "", price: 0, environment: "PRODUCTION", license_type: "YEARLY" }])}
          >
            <Plus size={14} /> Tambah Produk
          </button>
          <span className="ml-3 text-xs text-slate-400">Perubahan baru tersimpan setelah menekan Save.</span>
        </div>
      )}
    </Section>
  );
}
