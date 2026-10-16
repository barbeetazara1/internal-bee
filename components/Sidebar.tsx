"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, ChevronDown, ChevronLeft, ChevronRight, FolderKanban, KeyRound, LayoutDashboard, LineChart, MonitorPlay, Receipt, Search, Target, X, type LucideIcon } from "lucide-react";

/** Menu: tautan (href) atau grup (children, bisa bersarang). keywords: kata lain yang ikut dicocokkan saat mencari. */
type Node = { label: string; href?: string; keywords?: string; children?: Node[] };
type Item = Node & { icon: LucideIcon; roles: string[] };

const ALL = ["SUPER_ADMIN", "SALES", "PROJECT"];
const NAV: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/products", label: "Product Catalog", icon: Boxes, roles: ALL, keywords: "produk katalog harga billing" },
  {
    label: "Opportunities",
    icon: Target,
    roles: ["SUPER_ADMIN", "SALES"],
    keywords: "peluang crm penjualan sales prospek deal pipeline",
    children: [
      { href: "/leads", label: "Leads", keywords: "lead crm prospek penjualan sales deal kanban prioritas" },
      { href: "/activities", label: "Activity", keywords: "activity aktivitas jadwal call meeting demo follow-up kunjungan tugas" },
    ],
  },
  { href: "/demo", label: "Demo", icon: MonitorPlay, roles: ALL, keywords: "demo trial coba percobaan sandbox permintaan" },
  {
    label: "Clients & License",
    icon: KeyRound,
    roles: ALL,
    keywords: "klien pelanggan lisensi",
    children: [
      { href: "/clients", label: "Clients", keywords: "client klien pelanggan perusahaan customer" },
      {
        label: "Licenses",
        keywords: "license lisensi api key token",
        children: [
          { href: "/licenses", label: "Production", keywords: "produksi live lisensi license" },
          { href: "/licenses/demo", label: "Demo", keywords: "demo trial sandbox lisensi license" },
        ],
      },
    ],
  },
  { href: "/bills", label: "Bills", icon: Receipt, roles: ["SUPER_ADMIN", "SALES"], keywords: "bill tagihan invoice pembayaran billing lunas jatuh tempo" },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ALL, keywords: "proyek project task tugas kanban gantt" },
  { href: "/reports", label: "Laporan", icon: LineChart, roles: ["SUPER_ADMIN"], keywords: "report keuangan finansial revenue pendapatan" },
];

/** Halaman aktif. /licenses (Production) tidak ikut aktif saat berada di /licenses/demo. */
const on = (path: string, href: string) => {
  if (href === "/licenses") return path === "/licenses" || (path.startsWith("/licenses/") && !path.startsWith("/licenses/demo"));
  return path === href || path.startsWith(href + "/");
};
const anyActive = (path: string, n: Node): boolean => (n.href ? on(path, n.href) : false) || !!n.children?.some((c) => anyActive(path, c));
const leaves = (n: Node): string[] => (n.children ? n.children.flatMap(leaves) : n.href ? [n.href] : []);
const hit = (n: Node, q: string) => `${n.label} ${n.keywords ?? ""}`.toLowerCase().includes(q);

/** Menyaring menu (rekursif): grup tampil jika namanya cocok (semua isi ikut) atau ada isi yang cocok. */
function filterNode<T extends Node>(n: T, q: string): T | null {
  if (!q) return n;
  if (!n.children) return hit(n, q) ? n : null;
  if (hit(n, q)) return n;
  const kids = n.children.map((c) => filterNode(c, q)).filter((c): c is Node => c !== null);
  return kids.length ? { ...n, children: kids } : null;
}

// Sidebar selalu gelap di kedua tema, jadi memakai warna tetap (bukan token tema).
export default function Sidebar({ role, version }: { role: string; version: string }) {
  const path = usePathname();
  const router = useRouter();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [collapsed, setCollapsedState] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Tooltip nama menu saat sidebar ciut (fixed, supaya tidak terpotong oleh area scroll sidebar).
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const tipOn = (label: string) =>
    collapsed
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onMouseLeave: () => setTip(null),
          onFocus: (e: React.FocusEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onBlur: () => setTip(null),
        }
      : {};

  // Status ciut dibaca dari atribut <html> (diset skrip awal agar tidak berkedip) dan disimpan di localStorage.
  useEffect(() => setCollapsedState(document.documentElement.dataset.sb === "collapsed"), []);
  function setCollapsed(v: boolean) {
    setCollapsedState(v);
    setTip(null);
    if (v) document.documentElement.dataset.sb = "collapsed";
    else delete document.documentElement.dataset.sb;
    try {
      localStorage.setItem("sidebar", v ? "collapsed" : "open");
    } catch {}
  }

  const nq = q.trim().toLowerCase();
  const visible = NAV.filter((n) => n.roles.includes(role)).map((n) => filterNode(n, nq)).filter((n): n is Item => n !== null);
  const firstHref = visible.flatMap(leaves)[0];

  const linkCls = (active: boolean, pad: string) => `sb-link flex items-center gap-3 rounded-lg ${pad} text-sm transition ${active ? "bg-[#1e293b] text-amber-300" : "hover:bg-[#1e293b] hover:text-white"}`;

  function Group({ n, depth, icon: Icon }: { n: Node; depth: number; icon?: LucideIcon }) {
    const childActive = anyActive(path, n);
    const open = nq ? true : (opened[n.label] ?? childActive); // terbuka otomatis saat mencari, atau bila halaman aktif ada di dalam grup
    return (
      <div>
        <button
          onClick={() => {
            if (collapsed) {
              // Saat ciut, klik grup membuka kembali sidebar dengan grup terbuka.
              setCollapsed(false);
              setOpened({ ...opened, [n.label]: true });
            } else setOpened({ ...opened, [n.label]: !open });
          }}
          aria-expanded={open}
          {...tipOn(n.label)}
          className={`sb-link flex w-full items-center gap-3 rounded-lg ${depth ? "px-3 py-1.5" : "px-3 py-2"} text-sm transition ${childActive ? "text-amber-300" : "hover:bg-[#1e293b] hover:text-white"}`}
        >
          {Icon && <Icon size={18} className="shrink-0" />}
          <span className="sb-hide flex-1 text-left">{n.label}</span>
          <ChevronDown size={15} className={`sb-hide transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="sb-hide ml-5 mt-1 space-y-1 border-l border-[#1e293b] pl-3">
            {n.children!.map((c) =>
              c.children ? (
                <Group key={c.label} n={c} depth={depth + 1} />
              ) : (
                <Link key={c.href} href={c.href!} className={linkCls(on(path, c.href!), "px-3 py-1.5")}>
                  {c.label}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <aside className="app-sidebar no-print fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#0f172a] text-[#cbd5e1]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Buka menu" : "Ciutkan menu"}
        title={collapsed ? "Buka menu" : "Ciutkan menu"}
        className="sb-toggle absolute -right-3.5 top-[4.25rem] z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-surface text-slate-600 shadow-md transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <div className="sb-head flex items-center justify-center gap-2 px-4 pb-2 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="Internal Bee" className="sb-hide h-auto w-full max-w-[130px]" />
      </div>
      <div className="px-3 pt-3">
        <button
          onClick={() => {
            setCollapsed(false);
            setTimeout(() => searchRef.current?.focus(), 50);
          }}
          aria-label="Cari menu"
          {...tipOn("Cari menu")}
          className="sb-only sb-link hidden w-full items-center justify-center rounded-lg py-2 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
        >
          <Search size={18} />
        </button>
        <div className="sb-hide relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
              if (e.key === "Enter" && firstHref) {
                router.push(firstHref);
                setQ("");
              }
            }}
            placeholder="Cari menu…"
            aria-label="Cari menu"
            className="w-full rounded-lg border border-[#1e293b] bg-[#1e293b] py-1.5 pl-9 pr-8 text-sm text-[#e2e8f0] outline-none placeholder:text-[#64748b] focus:border-amber-400"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Hapus pencarian menu" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3">
        {visible.length === 0 && <div className="px-3 py-6 text-center text-sm text-[#64748b]">Menu tidak ditemukan</div>}
        {visible.map((n) =>
          n.children ? (
            <Group key={n.label} n={n} depth={0} icon={n.icon} />
          ) : (
            <Link key={n.href} href={n.href!} {...tipOn(n.label)} className={linkCls(on(path, n.href!), "px-3 py-2")}>
              <n.icon size={18} className="shrink-0" />
              <span className="sb-hide">{n.label}</span>
            </Link>
          ),
        )}
      </nav>
      <div className="sb-hide border-t border-[#1e293b] px-5 py-4 text-xs leading-relaxed text-[#94a3b8]">
        <div className="font-medium text-[#cbd5e1]">Versi {version}</div>
        <div>
          Powered by <span className="font-semibold text-amber-300">Internal Bee</span>
        </div>
      </div>
    </aside>
    {collapsed && tip && (
      <div role="tooltip" style={{ top: tip.top, left: tip.left }} className="no-print pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-md bg-[#020617] px-2.5 py-1.5 text-xs font-medium text-[#f1f5f9] shadow-lg ring-1 ring-[#334155]">
        <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#020617]" />
        {tip.label}
      </div>
    )}
    </>
  );
}
