"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, FileUp, Type, X } from "lucide-react";
import ProposalDocument from "./ProposalDocument";
import PdfFrame from "./PdfFrame";
import { toast } from "./toast";
import { saveProposalSettings } from "@/app/actions/proposal";
import { PROPOSAL_PLACEHOLDERS, resolveTemplate } from "@/lib/proposal-template";

export type ProposalForm = {
  mode: "TEXT" | "PDF";
  company_name: string; tagline: string; title: string; intro: string; scope: string; terms: string; closing: string; signer_name: string; signer_title: string; footer: string; validity_days: number;
  pdf_name: string | null; pdf_size: number | null;
};

const MODES = [
  { v: "TEXT" as const, icon: Type, title: "Teks (template berdesain)", desc: "Sistem membuat dokumen proposal berdesain dari lead. Anda cukup mengatur teksnya." },
  { v: "PDF" as const, icon: FileText, title: "File PDF", desc: "Unggah PDF proposal Anda sendiri. Tombol Print Proposal membuka file ini apa adanya." },
];

/** Settings → Proposal: pilih bentuk proposal (teks / PDF), atur teks template, atau unggah PDF. */
export default function ProposalSettingsForm({ initial, defaults }: { initial: ProposalForm; defaults: Omit<ProposalForm, "mode" | "pdf_name" | "pdf_size"> }) {
  const router = useRouter();
  const [mode, setMode] = useState(initial.mode);
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<"text" | "pdf" | null>(null);
  useEffect(() => {
    if (!preview) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [preview]);
  const set = (k: keyof ProposalForm, val: string | number) => setV((s) => ({ ...s, [k]: val }));

  function save() {
    const fd = new FormData();
    fd.set("mode", mode);
    for (const k of ["company_name", "tagline", "title", "intro", "scope", "terms", "closing", "signer_name", "signer_title", "footer", "validity_days"] as const) fd.set(k, String(v[k]));
    start(async () => {
      const r = await saveProposalSettings(fd);
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("pdf", f);
    const r = await fetch("/api/proposal/template", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ ok: false, message: "Upload failed" }));
    setBusy(false);
    if (file.current) file.current.value = "";
    toast(r.message, r.ok ? "success" : "error");
    if (r.ok) setV((s) => ({ ...s, pdf_name: r.name, pdf_size: r.size }));
    router.refresh();
  }
  async function removePdf() {
    setBusy(true);
    const r = await fetch("/api/proposal/template", { method: "DELETE" }).then((x) => x.json()).catch(() => ({ ok: false, message: "Failed" }));
    setBusy(false);
    toast(r.message, r.ok ? "success" : "error");
    if (r.ok) setV((s) => ({ ...s, pdf_name: null, pdf_size: null }));
    router.refresh();
  }

  const field = (k: "company_name" | "tagline" | "title" | "signer_name" | "signer_title" | "footer", label: string) => (
    <div>
      <label className="label">{label}</label>
      <input data-no-i18n className="input" value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder={(defaults[k] as string) || undefined} />
    </div>
  );
  const area = (k: "intro" | "scope" | "terms" | "closing", label: string, rows: number, hint?: string) => (
    <div>
      <label className="label">{label}{hint && <span className="ml-2 font-normal text-slate-400">{hint}</span>}</label>
      <textarea data-no-i18n className="input" rows={rows} value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder={defaults[k] as string} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Bentuk proposal" className="grid gap-3 md:grid-cols-2">
        {MODES.map((m) => (
          <button key={m.v} type="button" role="radio" aria-checked={mode === m.v} onClick={() => setMode(m.v)} className={`card flex items-start gap-3 p-4 text-left transition ${mode === m.v ? "border-amber-400 ring-2 ring-amber-400/30" : "hover:border-slate-300"}`}>
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mode === m.v ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-500"}`}><m.icon size={18} /></span>
            <span><span className="block font-semibold text-slate-900">{m.title}</span><span className="block text-sm text-slate-500">{m.desc}</span></span>
          </button>
        ))}
      </div>

      {mode === "TEXT" ? (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Teks template</h2>
              <p className="text-sm text-slate-500">Kosongkan kolom untuk memakai teks bawaan. Tabel produk dan total terisi otomatis dari lead.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setPreview("text")}>Pratinjau</button>
          </div>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Isian otomatis yang bisa dipakai di teks:{" "}
            {PROPOSAL_PLACEHOLDERS.map((p) => <code key={p.key} title={p.label} className="mr-1.5 rounded bg-slate-200/70 px-1.5 py-0.5">{p.key}</code>)}
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">{field("company_name", "Nama perusahaan")}{field("tagline", "Tagline")}{field("title", "Judul dokumen")}</div>
            {area("intro", "Pembukaan", 4)}
            {area("scope", "Ruang lingkup", 3)}
            {area("terms", "Syarat & ketentuan", 5, "(satu baris = satu butir)")}
            {area("closing", "Penutup", 3)}
            <div className="grid gap-4 md:grid-cols-3">
              {field("signer_name", "Nama penandatangan")}{field("signer_title", "Jabatan")}
              <div>
                <label className="label">Masa berlaku (hari)</label>
                <input className="input" type="number" min={1} max={365} value={v.validity_days} onChange={(e) => set("validity_days", e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-400">Nama penandatangan kosong = memakai nama pemilik lead.</p>
            {field("footer", "Teks kaki dokumen")}
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">File PDF proposal</h2>
          <p className="mb-4 text-sm text-slate-500">PDF dicetak apa adanya (tidak diisi otomatis dengan data lead). Maksimal 4 MB.</p>
          {v.pdf_name ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <FileText size={20} className="text-slate-500" />
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{v.pdf_name}</div><div className="text-xs text-slate-500">{v.pdf_size ? `${(v.pdf_size / 1024).toFixed(0)} KB` : ""}</div></div>
              <button type="button" className="btn btn-sm" onClick={() => setPreview("pdf")}>Lihat</button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => file.current?.click()}>Ganti</button>
              <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={removePdf}>Hapus</button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-slate-500 transition hover:border-amber-400 hover:text-slate-700">
              <FileUp size={26} /><span className="font-medium">{busy ? "Mengunggah…" : "Pilih file PDF"}</span>
            </button>
          )}
          <input ref={file} type="file" accept="application/pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
          {!v.pdf_name && <p className="mt-3 text-xs text-amber-700">Belum ada PDF. Selama kosong, Print Proposal memakai template teks.</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>{pending ? "Menyimpan…" : "Simpan Pengaturan"}</button>
        <span className="text-sm text-slate-400">Pilihan bentuk &amp; teks tersimpan setelah menekan Simpan. Unggah/hapus PDF langsung berlaku.</span>
      </div>
      {preview && createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-label="Pratinjau proposal" className="card w-full max-w-4xl p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div><h2 className="font-semibold text-slate-900">Pratinjau proposal</h2><p className="text-xs text-slate-500">{preview === "text" ? "Data contoh, sesuai isian di form (belum perlu disimpan)." : v.pdf_name}</p></div>
              <button type="button" aria-label="Tutup" className="btn h-8 w-8 !p-0" onClick={() => setPreview(null)}><X size={16} /></button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto bg-slate-100 p-4">
              {preview === "text" ? (
                <ProposalDocument
                  template={resolveTemplate(v)}
                  data={{ number: "PRP-CONTOH", date: new Date(), lead: "OCR untuk verifikasi KYC", client: "PT Contoh Sejahtera", contact: "Budi Santoso", email: "budi@contoh.co.id", phone: "0812-0000-0000", owner: "Sales Anda",
                    lines: [{ name: "PROD-OCR-01 — Internal Bee OCR API", license: "Tahunan", price: 12500000 }, { name: "PROD-WA-01 — Internal Bee WhatsApp Gateway", license: "Bulanan", price: 3500000 }],
                    addons: [{ name: "Cloud Hosting Standard", billing: "Bulanan", periods: "12 bulan", unit: 500000, subtotal: 6000000, billed: true }, { name: "Domain .com", billing: "Tahunan", periods: "", unit: 200000, subtotal: 200000, billed: false }] }}
                />
              ) : (
                <PdfFrame src="/api/proposal/template" withPrint={false} className="h-[68vh]" />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
