"use client";

/** Input bilangan bulat: hanya angka 0-9 yang bisa diketik atau ditempel (huruf, e, +, -, . ditolak). */
export default function NumericInput({ value, onChange, maxDigits = 9, className = "", ...rest }: { value: string; onChange: (v: string) => void; maxDigits?: number; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
      className={`input ${className}`}
    />
  );
}
