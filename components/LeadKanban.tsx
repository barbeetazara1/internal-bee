"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { LEAD_FINAL, LEAD_LABEL, LEAD_STATUSES, canMoveLead } from "@/lib/constants";
import { idr } from "@/lib/format";
import { closeWon, setLeadStatus } from "@/app/actions/leads";
import { confirmDialog } from "./confirm";
import { toast } from "./toast";
import PaymentDialog, { type PayLine } from "./PaymentDialog";

export type KanbanLead = { id: string; title: string; client: string; contact: string; owner: string; status: string; value: number; products: number; created: string; lines: PayLine[] };

const FINAL = LEAD_FINAL as readonly string[];
const ORDER = LEAD_STATUSES as readonly string[];

/** Aturan drop (sama dengan form lead): hanya maju, tahap final terkunci, Qualified+ butuh produk, Closed Won hanya dari Negosiasi. */
function dropCheck(l: KanbanLead, to: string): string | null {
  if (l.status === to) return null;
  if (FINAL.includes(l.status)) return "Lead yang sudah ditutup tidak bisa dipindahkan";
  if (!canMoveLead(l.status, to)) return "Status hanya bisa maju, tidak bisa dikembalikan ke tahap sebelumnya";
  if (to === "CLOSED_WON" && l.status !== "NEGOTIATION") return "Closed Won hanya bisa dari tahap Negosiasi";
  if (to !== "CLOSED_LOST" && ORDER.indexOf(to) >= 2 && l.products === 0) return "Tambahkan minimal 1 produk di lead ini (dan Save) sebelum pindah ke tahap ini";
  return null;
}

const DOT: Record<string, string> = {
  NEW: "bg-slate-400", CONTACTED: "bg-sky-500", QUALIFIED: "bg-violet-500", PROPOSAL: "bg-amber-500",
  NEGOTIATION: "bg-orange-500", CLOSED_WON: "bg-emerald-500", CLOSED_LOST: "bg-red-500",
};
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/**
 * Tampilan Kanban lead per status. Kartu bisa di-drag ke tahap berikutnya (hanya maju, tidak bisa dikembalikan).
 * Drop ke Closed Won membuka modal sistem pembayaran; drop ke Closed Lost meminta konfirmasi.
 */
export default function LeadKanban({ leads }: { leads: KanbanLead[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [items, setItems] = useState(leads);
  const [drag, setDrag] = useState<KanbanLead | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [won, setWon] = useState<KanbanLead | null>(null);
  useEffect(() => setItems(leads), [leads]);

  async function drop(l: KanbanLead, to: string) {
    setDrag(null);
    setOver(null);
    if (l.status === to) return;
    const reason = dropCheck(l, to);
    if (reason) return toast(reason, "error");
    if (to === "CLOSED_WON") return setWon(l); // butuh sistem pembayaran: modal, lalu server membuat project, key, dan bills
    const lost = to === "CLOSED_LOST";
    const ok = await confirmDialog(
      lost
        ? { title: "Tandai sebagai Closed Lost?", message: "Lead ini dianggap gagal dan statusnya tidak bisa dikembalikan ke tahap sebelumnya.", confirmLabel: "Ya, Closed Lost", danger: true }
        : { title: `Pindah ke ${LEAD_LABEL[to]}?`, message: "Status hanya bisa maju dan tidak bisa dikembalikan ke tahap sebelumnya.", confirmLabel: `Ya, ${LEAD_LABEL[to]}` },
    );
    if (!ok) return;
    const prev = items;
    setItems((x) => x.map((i) => (i.id === l.id ? { ...i, status: to } : i))); // optimistis
    const fd = new FormData();
    fd.set("id", l.id);
    fd.set("status", to);
    start(async () => {
      try {
        await setLeadStatus(fd); // gagal validasi di server = redirect dengan pesan error
        router.refresh();
      } catch {
        setItems(prev);
        toast("Something went wrong. Please try again.", "error");
      }
    });
  }

  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("topbar-search")), []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter((l) => [l.title, l.client, l.contact, l.owner].some((t) => t.toLowerCase().includes(n))) : items;
  }, [items, q]);

  const search = (
    <div className="relative w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari lead, client, kontak…" className="input !rounded-full !py-1.5 pl-9 pr-8" aria-label="Cari lead" />
      {q && (
        <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Hapus pencarian">
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div>
      {slot ? createPortal(search, slot) : <div className="mb-3">{search}</div>}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((s) => {
          const col = filtered.filter((l) => l.status === s);
          const total = col.reduce((a, l) => a + l.value, 0);
          const ok = drag ? drag.status !== s && !dropCheck(drag, s) : false; // kolom yang boleh menerima kartu yang sedang di-drag
          return (
            <section
              key={s}
              aria-label={LEAD_LABEL[s]}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = ok ? "move" : "none";
                setOver(s);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) void drop(drag, s);
              }}
              className={`w-72 shrink-0 rounded-xl border p-3 transition ${
                drag ? (ok ? (over === s ? "border-amber-400 bg-amber-400/15" : "border-dashed border-amber-300 bg-slate-100/60") : "border-slate-200 bg-slate-100/60 opacity-50") : "border-slate-200 bg-slate-100/60"
              }`}
            >
              <header className="mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {LEAD_LABEL[s]}
                  <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{col.length}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{idr(total)}</div>
              </header>
              <div className="space-y-2">
                {col.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">Tidak ada lead</div>}
                {col.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    draggable={!FINAL.includes(l.status)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDrag(l);
                    }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    className={`block rounded-lg border border-slate-200 bg-surface p-3 shadow-sm transition hover:border-amber-300 hover:shadow ${FINAL.includes(l.status) ? "" : "cursor-grab active:cursor-grabbing"} ${drag?.id === l.id ? "opacity-40" : ""}`}
                  >
                    <div className="mb-1 text-sm font-medium leading-snug">{l.title}</div>
                    <div className="text-xs text-slate-500">{l.client}</div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{idr(l.value)}</span>
                      <span className="text-slate-400">{l.products} produk</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-900" title={l.owner}>{initials(l.owner)}</span>
                        {l.owner}
                      </span>
                      <span>{l.created}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {won && (
        <PaymentDialog
          open
          onClose={() => setWon(null)}
          leadId={won.id}
          lines={won.lines}
          action={closeWon}
          title="Tutup sebagai Closed Won?"
          intro="Atur sistem pembayarannya. Setelah ditutup, sistem otomatis membuat Project beserta task board, API Key untuk tiap produk, dan Bills sesuai pilihan di bawah. Lead tidak bisa dikembalikan ke status sebelumnya."
          confirmLabel="Ya, Closed Won"
        />
      )}
    </div>
  );
}
