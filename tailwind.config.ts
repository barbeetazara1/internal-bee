import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const slate = Object.fromEntries(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((s) => [s, v(`slate-${s}`)]));

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Satu huruf untuk semuanya: font-mono & font-display dipetakan ke huruf yang sama (angka dibuat rata lewat tabular-nums)
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: { slate, surface: v("surface") },
      // Teks ~1px lebih besar dari bawaan Tailwind di setiap tingkat.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.2rem" }],
        sm: ["0.9375rem", { lineHeight: "1.4rem" }],
        base: ["1.0625rem", { lineHeight: "1.65rem" }],
        lg: ["1.1875rem", { lineHeight: "1.8rem" }],
        xl: ["1.3125rem", { lineHeight: "1.9rem" }],
        "2xl": ["1.5625rem", { lineHeight: "2.15rem" }],
        "3xl": ["1.9375rem", { lineHeight: "2.4rem" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
