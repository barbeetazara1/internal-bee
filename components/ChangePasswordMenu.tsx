"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X } from "lucide-react";
import ActionsMenu from "./ActionsMenu";
import { changePassword } from "@/app/actions/users";
import { toast } from "./toast";

/** More Actions untuk form User: berisi Change Password yang membuka modal (password lama + baru). */
export default function ChangePasswordMenu({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const oldRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset pesan & fokus hanya saat modal dibuka (bukan saat proses simpan selesai).
  useEffect(() => {
    if (!open) return;
    setError(null);
    const t = setTimeout(() => oldRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, pending]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const oldPw = String(fd.get("old") ?? "");
    const newPw = String(fd.get("new") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (newPw !== confirm) return setError("New password and confirmation do not match");
    setError(null);
    start(async () => {
      const r = await changePassword(userId, oldPw, newPw);
      if (r.ok) {
        toast(r.message, "success");
        formRef.current?.reset();
        setOpen(false);
      } else setError(r.message);
    });
  }

  return (
    <>
      <ActionsMenu items={[{ label: "Change Password", id: "password", icon: "key" }]} onSelect={() => setOpen(true)} />
      {/* Dirender di <body> agar tidak terjebak di elemen ber-transform (pembungkus menu di tengah bar). */}
      {open && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !pending && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pw-title" className="card w-full max-w-md p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><KeyRound size={20} /></span>
              <div className="min-w-0 flex-1">
                <h2 id="pw-title" className="text-base font-semibold text-slate-900">Change Password</h2>
                <p className="text-sm text-slate-500">Akun: {userName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup"><X size={18} /></button>
            </div>
            <form ref={formRef} onSubmit={submit} className="space-y-3">
              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div><label className="label">Password lama<span className="text-red-500"> *</span></label><input ref={oldRef} name="old" type="password" required autoComplete="current-password" className="input" /></div>
              <div><label className="label">Password baru<span className="text-red-500"> *</span> <span className="font-normal text-slate-400">(min. 8 karakter)</span></label><input name="new" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
              <div><label className="label">Konfirmasi password baru<span className="text-red-500"> *</span></label><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Change Password"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
