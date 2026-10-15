"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, UploadCloud, X } from "lucide-react";
import { toast } from "./toast";

const OK_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const MAX = 5 * 1024 * 1024;
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Tombol "Tandai Lunas": membuka modal untuk melampirkan bukti pembayaran (PNG, JPG, atau PDF) yang wajib. */
export default function PaidDialog({ billId, code, amount }: { billId: string; code: string; amount: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError("");
    setBusy(false);
  }
  function pick(f: File | undefined) {
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) return setError("Proof must be a PNG, JPG or PDF file");
    if (f.size > MAX) return setError("Proof file must be 5 MB or smaller");
    if (preview) URL.revokeObjectURL(preview);
    setError("");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Payment proof is required");
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("proof", file);
      const res = await fetch(`/api/bills/${billId}/proof`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { ok: boolean; message: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      toast(data.message);
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const modal = open && (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && !busy && (setOpen(false), reset())}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Tandai Lunas" className="card w-full max-w-lg p-0 shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Tandai lunas: {code}</h2>
          <p className="mt-1 text-sm text-slate-500">Lampirkan bukti pembayaran sebesar <b className="text-slate-800">{amount}</b> (PNG, JPG, atau PDF, maks. 5 MB). Bukti wajib diisi.</p>
        </div>
        <div className="px-6 py-5">
          <input ref={input} type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          {!file ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-amber-400 bg-amber-400/10" : "border-slate-300 hover:border-slate-400"}`}
            >
              <UploadCloud size={28} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Pilih file atau tarik ke sini</span>
              <span className="text-xs text-slate-400">PNG, JPG, atau PDF · maks. 5 MB</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Pratinjau bukti" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><FileText size={26} /></span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800"><Paperclip size={14} className="shrink-0 text-slate-400" />{file.name}</div>
                <div className="text-xs text-slate-500">{size(file.size)}</div>
              </div>
              <button type="button" aria-label="Hapus file" onClick={() => { reset(); if (input.current) input.current.value = ""; }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" className="btn" disabled={busy} onClick={() => { setOpen(false); reset(); }}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !file}>{busy ? "Mengunggah…" : "Tandai Lunas"}</button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>✓ Tandai Lunas</button>
      {modal && createPortal(modal, document.body)}
    </>
  );
}
