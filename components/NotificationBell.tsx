"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/comments";

export type NotificationDTO = { id: string; read: boolean; author: string; label: string; snippet: string; link: string; created_at: string };

const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

export default function NotificationBell({ items }: { items: NotificationDTO[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    // Perbarui notifikasi secara berkala tanpa reload halaman.
    const t = setInterval(() => router.refresh(), 30000);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      clearInterval(t);
    };
  }, [router]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn relative h-9 w-9 !p-0" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-haspopup="menu" aria-expanded={open}>
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            {unread > 0 && (
              <button className="text-xs text-amber-600 hover:underline" onClick={() => start(() => markAllNotificationsRead())}>
                Mark All as Read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  role="menuitem"
                  className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.read ? "" : "bg-amber-50"}`}
                  onClick={() => {
                    setOpen(false);
                    start(async () => {
                      if (!n.read) await markNotificationRead(n.id);
                      router.push(n.link);
                    });
                  }}
                >
                  <div className="text-sm text-slate-800">
                    <b>{n.author}</b> mentioned you in <b>{n.label}</b>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.snippet}</div>
                  <div className="mt-1 text-xs text-slate-400">{ago(n.created_at)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
