"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { revealServicePassword } from "@/app/actions/services";
import { toast } from "./toast";
import PasswordInput from "./PasswordInput";
import { useRecord } from "./Record";

/** Password tersimpan: tersembunyi; "mata" memintanya dari server (tercatat di riwayat), tampil 30 detik lalu disembunyikan lagi. */
export default function StoredSecret({ serviceId, has }: { serviceId: string; has: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!has) return <span className="text-slate-400">—</span>;
  const hide = () => {
    clearTimeout(timer.current);
    setValue(null);
  };
  const reveal = () =>
    start(async () => {
      const r = await revealServicePassword(serviceId);
      if (!r.ok) return toast(r.message ?? "Failed", "error");
      setValue(r.password!);
      timer.current = setTimeout(() => setValue(null), 30000);
    });
  return (
    <span className="inline-flex items-center gap-1.5">
      <code data-no-i18n className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{value ?? "••••••••••"}</code>
      <button type="button" disabled={pending} onClick={value ? hide : reveal} aria-label={value ? "Sembunyikan password" : "Tampilkan password"} title={value ? "Sembunyikan password" : "Tampilkan password"} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        {value ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {value && (
        <button type="button" aria-label="Salin password" title="Salin password" onClick={() => navigator.clipboard?.writeText(value).then(() => toast("Copied", "success"))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Copy size={15} />
        </button>
      )}
    </span>
  );
}

/** Field password pada form layanan: mode baca = password tersembunyi + tombol mata; mode edit = isian password baru (kosong = tidak diubah). */
export function ServiceSecretField({ serviceId, has }: { serviceId: string; has: boolean }) {
  const { editing } = useRecord();
  return editing ? (
    <PasswordInput name="password" autoComplete="new-password" maxLength={200} placeholder={has ? "Kosongkan bila tidak diubah" : "Password server"} />
  ) : (
    <div className="flex min-h-[2.25rem] items-center text-sm"><StoredSecret serviceId={serviceId} has={has} /></div>
  );
}
