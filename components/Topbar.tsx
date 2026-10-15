"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import NotificationBell, { type NotificationDTO } from "./NotificationBell";

function ThemeMenuItem() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button role="menuitemcheckbox" aria-checked={dark} onClick={toggle} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-2">
        {dark ? <Moon size={15} /> : <Sun size={15} />} Mode Gelap
      </span>
      <span className={`relative h-5 w-9 rounded-full transition ${dark ? "bg-amber-400" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${dark ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export default function Topbar({ user, notifications }: { user: { name: string; email: string; role: string }; notifications: NotificationDTO[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/85 px-8 backdrop-blur">
      {/* Slot untuk search generik milik list view (diisi lewat portal) */}
      <div id="topbar-search" className="min-w-0 flex-1" />
      <NotificationBell items={notifications} />
      <Link href="/settings" className="btn h-9 w-9 !p-0" aria-label="Settings" title="Settings">
        <Settings size={17} />
      </Link>
      <div ref={ref} className="relative">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100" aria-haspopup="menu" aria-expanded={open}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">{initials}</span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-800">{user.name}</span>
            <span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown size={15} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-lg">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="truncate text-sm font-semibold text-slate-800">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
              <div className="mt-1 text-xs text-amber-600">{ROLE_LABEL[user.role]}</div>
            </div>
            <div className="border-b border-slate-100 py-1"><ThemeMenuItem /></div>
            <form action={logoutAction}>
              <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-slate-50">
                <LogOut size={15} /> Keluar
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
