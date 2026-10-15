"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { settleConfirm, type ConfirmOptions } from "./confirm";

type Item = { id: number; opts: ConfirmOptions };

/** Dialog konfirmasi global. Dipasang sekali di root layout. */
export default function ConfirmHost() {
  const [queue, setQueue] = useState<Item[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const cur = queue[0];

  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, (e as CustomEvent).detail as Item]);
    window.addEventListener("app:confirm", on);
    return () => window.removeEventListener("app:confirm", on);
  }, []);

  function answer(v: boolean) {
    if (!cur) return;
    settleConfirm(cur.id, v);
    setQueue((q) => q.slice(1));
  }

  useEffect(() => {
    if (!cur) return;
    // Tindakan berisiko: fokus awal di Cancel supaya tidak terkonfirmasi tak sengaja dengan Enter.
    (cur.opts.danger ? cancelRef : okRef).current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        answer(false);
      }
      if (e.key === "Tab") {
        // fokus tetap berputar di antara dua tombol dialog
        e.preventDefault();
        (document.activeElement === cancelRef.current ? okRef : cancelRef).current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  if (!cur) return null;
  const { title, message, confirmLabel, cancelLabel, danger } = cur.opts;
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" className="card w-full max-w-md p-6 shadow-2xl">
        <div className="flex gap-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title ?? (danger ? "Are you sure?" : "Please confirm")}</h2>
            <p id="confirm-msg" className="mt-1 whitespace-pre-line text-sm text-slate-500">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn" onClick={() => answer(false)}>{cancelLabel ?? "Cancel"}</button>
          <button
            ref={okRef}
            type="button"
            className={danger ? "btn border-red-600 bg-red-600 text-white hover:bg-red-500" : "btn btn-primary"}
            onClick={() => answer(true)}
          >
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
