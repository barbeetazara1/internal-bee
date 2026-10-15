"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { ToastTone } from "./toast";

type T = { id: number; message: string; tone: ToastTone };
const STYLE: Record<ToastTone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  info: "border-sky-300 bg-sky-50 text-sky-800",
  error: "border-red-300 bg-red-50 text-red-800",
};
const ICON = { success: CheckCircle2, info: Info, error: XCircle };

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail as { message: string; tone: ToastTone };
      const id = ++n;
      setItems((l) => [...l, { id, message, tone }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener("app:toast", on);
    return () => window.removeEventListener("app:toast", on);
  }, []);
  return (
    <div className="no-print pointer-events-none fixed right-6 top-20 z-[100] flex w-80 flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div key={t.id} role="status" className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${STYLE[t.tone]}`}>
            <Icon size={18} /> {t.message}
          </div>
        );
      })}
    </div>
  );
}
