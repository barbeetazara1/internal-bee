"use client";

const ALLOWED = /[^0-9+()\-\s]/g;

/** Nomor telepon: hanya angka dan karakter + ( ) - spasi. Karakter lain dibuang saat mengetik/menempel. */
export default function PhoneInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onInput">) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      maxLength={20}
      onInput={(e) => {
        const el = e.currentTarget;
        const clean = el.value.replace(ALLOWED, "");
        if (clean !== el.value) {
          const pos = (el.selectionStart ?? clean.length) - (el.value.length - clean.length);
          el.value = clean;
          el.setSelectionRange(pos, pos);
        }
      }}
    />
  );
}
