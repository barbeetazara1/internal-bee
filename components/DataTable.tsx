"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Search, X } from "lucide-react";
import { toast } from "./toast";
import { confirmDialog } from "./confirm";

export type Col = {
  key: string;
  label: string;
  /** Tampilkan ikon search di header kolom (default true). */
  filterable?: boolean;
  /** Ikut di export CSV (default true). */
  exportable?: boolean;
  /** Tidak ditampilkan sebagai kolom (tetap ikut pencarian & export), mis. kolom yang dipakai untuk group-by. */
  hidden?: boolean;
};
export type Cell = { text: string; node?: React.ReactNode };
export type Row = {
  id: string;
  cells: Record<string, Cell>;
  selectable?: boolean;
  /** Jika diisi, klik di mana saja pada baris membuka record. */
  href?: string;
  /** Nama grup (dipakai bila tabel diberi `groupLabel`). */
  group?: string;
};
export type BulkAction = { label: string; run: (ids: string[]) => Promise<unknown>; confirm?: string; danger?: boolean };

const norm = (s: string) => s.toLowerCase();

export default function DataTable({
  columns,
  rows,
  actions = [],
  searchPlaceholder = "Cari…",
  emptyText = "Tidak ada data.",
  exportName = "data",
  groupLabel,
}: {
  columns: Col[];
  rows: Row[];
  actions?: BulkAction[];
  searchPlaceholder?: string;
  emptyText?: string;
  exportName?: string;
  /** Mengelompokkan baris berdasarkan `row.group` (group-by), mis. "Client". */
  groupLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  // Search generik ditaruh di paling atas halaman (topbar) lewat portal.
  useEffect(() => setSlot(document.getElementById("topbar-search")), []);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return rows.filter((r) => {
      if (nq && !columns.some((c) => norm(r.cells[c.key]?.text ?? "").includes(nq)) && !norm(r.group ?? "").includes(nq)) return false;
      return Object.entries(filters).every(([k, v]) => !v.trim() || norm(r.cells[k]?.text ?? "").includes(norm(v.trim())));
    });
  }, [rows, columns, q, filters]);

  const vis = useMemo(() => columns.filter((c) => !c.hidden), [columns]);
  const groups = useMemo(() => {
    if (!groupLabel) return null;
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const g = r.group ?? "—";
      m.set(g, [...(m.get(g) ?? []), r]);
    }
    return [...m.entries()];
  }, [filtered, groupLabel]);

  // Seleksi hanya berlaku untuk baris yang sedang tampil & masih ada.
  const visibleIds = useMemo(() => new Set(filtered.filter((r) => r.selectable !== false).map((r) => r.id)), [filtered]);
  const selectedIds = useMemo(() => [...selected].filter((id) => visibleIds.has(id)), [selected, visibleIds]);
  const allSelected = visibleIds.size > 0 && selectedIds.length === visibleIds.size;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selectedIds.length > 0 && !allSelected;
  }, [selectedIds.length, allSelected]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function exportCsv() {
    const cols = columns.filter((c) => c.exportable !== false && c.label);
    const pick = selectedIds.length ? filtered.filter((r) => selectedIds.includes(r.id)) : filtered;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c.label)).join(","), ...pick.map((r) => cols.map((c) => esc(r.cells[c.key]?.text ?? "")).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenu(false);
  }

  async function run(a: BulkAction) {
    if (a.confirm) {
      const ok = await confirmDialog({
        title: a.danger ? `${a.label} ${selectedIds.length} record(s)?` : a.label,
        message: a.confirm.replace("{n}", String(selectedIds.length)),
        confirmLabel: a.label,
        danger: a.danger,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = (await a.run(selectedIds)) as { ok?: boolean; message?: string } | undefined;
      if (r?.message) toast(r.message, r.ok === false ? "error" : "success");
      setSelected(new Set());
      setMenu(false);
    } finally {
      setBusy(false);
    }
  }

  const searchBox = (
    <div className="relative w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="input !rounded-full !py-1.5 pl-9 pr-8" aria-label="Cari di semua kolom" />
      {q && (
        <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Hapus pencarian">
          <X size={14} />
        </button>
      )}
    </div>
  );

  const activeFilters = Object.values(filters).filter((v) => v.trim()).length;

  return (
    <div>
      {slot ? createPortal(searchBox, slot) : <div className="mb-3">{searchBox}</div>}

      <div className="mb-3 flex min-h-9 flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">
          {filtered.length === rows.length ? `${rows.length} data` : `${filtered.length} dari ${rows.length} data`}{groups ? ` · ${groups.length} ${groupLabel!.toLowerCase()}` : ""}
        </span>
        {activeFilters > 0 && (
          <button className="text-xs text-amber-600 hover:underline" onClick={() => setFilters({})}>
            Reset {activeFilters} Filter Kolom
          </button>
        )}

        {groups && groups.length > 0 && (
          <button
            className="text-xs text-slate-500 hover:underline"
            onClick={() => setCollapsed(collapsed.size === groups.length ? new Set() : new Set(groups.map(([g]) => g)))}
          >
            {collapsed.size === groups.length ? "Expand All" : "Collapse All"}
          </button>
        )}

        {/* "More Actions" hanya muncul jika ada record yang dipilih */}
        {selectedIds.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-slate-600">{selectedIds.length} dipilih</span>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>
              Batal
            </button>
            <div ref={menuRef} className="relative">
              <button className="btn btn-primary" onClick={() => setMenu(!menu)} disabled={busy} aria-haspopup="menu" aria-expanded={menu}>
                More Actions <ChevronDown size={14} />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lg">
                  {actions.map((a) => (
                    <button
                      key={a.label}
                      role="menuitem"
                      onClick={() => run(a)}
                      className={`block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 ${a.danger ? "text-red-600" : "text-slate-700"}`}
                    >
                      {a.label}
                    </button>
                  ))}
                  {actions.length > 0 && <div className="my-1 border-t border-slate-100" />}
                  <button role="menuitem" onClick={exportCsv} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input ref={allRef} type="checkbox" checked={allSelected} disabled={visibleIds.size === 0} onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))} className="h-4 w-4 accent-amber-500" aria-label="Pilih semua" />
              </th>
              {vis.map((c) => {
                const val = filters[c.key] ?? "";
                const active = !!val.trim();
                const open = editing === c.key;
                const canFilter = c.filterable !== false && !!c.label;
                // Saat dibuka, seluruh sel header berubah menjadi search bar (label digantikan).
                if (canFilter && open) {
                  return (
                    <th key={c.key} className="bg-amber-50 px-4 py-1.5 align-middle">
                      <div className="flex min-w-[190px] items-center gap-2 normal-case tracking-normal">
                        <input
                          autoFocus
                          value={val}
                          onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setFilters({ ...filters, [c.key]: "" });
                              setEditing(null);
                            }
                            if (e.key === "Enter") setEditing(null);
                          }}
                          placeholder="Search..."
                          aria-label={`Filter ${c.label}`}
                          className="w-full border-0 border-b-2 border-amber-600 bg-transparent px-0 py-1 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                        />
                        <button
                          aria-label={`Tutup & hapus filter ${c.label}`}
                          title="Tutup & hapus filter"
                          onClick={() => {
                            setFilters({ ...filters, [c.key]: "" });
                            setEditing(null);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white hover:bg-amber-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </th>
                  );
                }
                return (
                  <th key={c.key} className="th group whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {c.label}
                      {canFilter && (
                        <button
                          aria-label={`Filter ${c.label}`}
                          title={active ? `Filter: ${val}` : undefined}
                          onClick={() => setEditing(c.key)}
                          className={`rounded p-0.5 transition hover:bg-slate-200 focus:opacity-100 ${active ? "text-amber-600 opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          <Search size={13} />
                        </button>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={vis.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                  {rows.length === 0 ? emptyText : "Tidak ada data yang cocok dengan pencarian."}
                </td>
              </tr>
            )}
            {(groups ? groups : [[null, filtered] as [string | null, Row[]]]).map(([g, rs]) => (
              <Fragment key={g ?? "all"}>
                {g !== null && (
                  <tr className="bg-slate-50">
                    <td className="w-10 px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Pilih semua di ${g}`}
                        className="h-4 w-4 accent-amber-500"
                        checked={rs.filter((r) => r.selectable !== false).length > 0 && rs.filter((r) => r.selectable !== false).every((r) => selectedIds.includes(r.id))}
                        onChange={(e) => {
                          const ids = rs.filter((r) => r.selectable !== false).map((r) => r.id);
                          setSelected((prev) => {
                            const n = new Set(prev);
                            ids.forEach((i) => (e.target.checked ? n.add(i) : n.delete(i)));
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td colSpan={vis.length} className="px-4 py-2">
                      <button
                        className="flex items-center gap-2 text-sm font-semibold"
                        onClick={() => setCollapsed((c) => { const n = new Set(c); n.has(g) ? n.delete(g) : n.add(g); return n; })}
                        aria-expanded={!collapsed.has(g)}
                      >
                        {collapsed.has(g) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        {g}
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{rs.length}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {(g !== null && collapsed.has(g) ? [] : rs).map((r) => {
              const sel = selectedIds.includes(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={(e) => {
                    if (!r.href || (e.target as HTMLElement).closest("a,button,input,select,textarea,label,form")) return;
                    router.push(r.href);
                  }}
                  className={`${sel ? "bg-amber-50" : "hover:bg-slate-50"} ${r.href ? "cursor-pointer" : ""}`}
                >
                  <td className="w-10 px-4 py-3">
                    {r.selectable !== false && <input type="checkbox" checked={sel} onChange={() => toggle(r.id)} className="h-4 w-4 accent-amber-500" aria-label="Pilih baris" />}
                  </td>
                  {vis.map((c) => (
                    <td key={c.key} className="td">
                      {r.cells[c.key]?.node ?? r.cells[c.key]?.text}
                    </td>
                  ))}
                </tr>
              );
            })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
