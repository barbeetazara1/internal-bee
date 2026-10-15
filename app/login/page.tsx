"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Internal Bee" className="mx-auto h-44 w-auto" />
          <p className="mt-2 text-center text-sm text-slate-400">Portal Internal & Licensing</p>
        </div>
        <form action={action} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required autoFocus className="input" placeholder="nama@internalbee.local" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required className="input" />
          </div>
          <button disabled={pending} className="btn btn-primary w-full">
            {pending ? "Masuk…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
