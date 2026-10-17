"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Kolom password dengan tombol mata untuk menampilkan/menyembunyikan isian. Semua props input diteruskan (name, required, ref, dst). */
const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput({ className = "input", ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} {...rest} type={show ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        title={show ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});
export default PasswordInput;
