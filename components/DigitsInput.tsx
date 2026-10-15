"use client";

/** Input angka murni (mis. kode pos): karakter selain 0-9 dibuang saat mengetik atau menempel. */
export default function DigitsInput({ maxLength = 10, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onInput">) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="postal-code"
      maxLength={maxLength}
      onInput={(e) => {
        const el = e.currentTarget;
        const clean = el.value.replace(/\D/g, "");
        if (clean !== el.value) {
          const pos = (el.selectionStart ?? clean.length) - (el.value.length - clean.length);
          el.value = clean;
          el.setSelectionRange(pos, pos);
        }
      }}
    />
  );
}
