import { DICT, TO_ID_ONLY } from "./i18n-dict";
import type { Lang } from "./lang";

type Rule = { re: RegExp; out: string; weight: number };
const exact: Record<Lang, Map<string, string>> = { id: new Map(), en: new Map() };
const rules: Record<Lang, Rule[]> = { id: [], en: [] };

const hasSlot = (s: string) => /\{\d\}/.test(s);

function register(lang: Lang, src: string, out: string) {
  if (!hasSlot(src)) {
    if (!exact[lang].has(src)) exact[lang].set(src, out);
    return;
  }
  const parts = src.split(/\{\d\}/);
  const re = new RegExp("^" + parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.*?)") + "$", "s");
  const order = [...src.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1]));
  // Urutan slot pada pola sumber → nomor slot pada keluaran
  rules[lang].push({ re, out: out.replace(/\{(\d)\}/g, (_, n) => `\u0000${order.indexOf(Number(n)) + 1}\u0000`), weight: parts.join("").length });
}

for (const [id, en, ...alias] of DICT) {
  register("en", id, en);
  register("id", en, id);
  for (const a of alias) {
    register("en", a, en);
    register("id", a, id);
  }
}
for (const [en, id] of TO_ID_ONLY) register("id", en, id);
for (const l of ["id", "en"] as Lang[]) rules[l].sort((a, b) => b.weight - a.weight);

const MONTHS: Record<Lang, [RegExp, Record<string, string>]> = {
  en: [/\b(\d{1,2}) (Mei|Agu|Okt|Des) (\d{4})\b/g, { Mei: "May", Agu: "Aug", Okt: "Oct", Des: "Dec" }],
  id: [/\b(\d{1,2}) (May|Aug|Oct|Dec) (\d{4})\b/g, { May: "Mei", Aug: "Agu", Oct: "Okt", Dec: "Des" }],
};

function core(text: string, lang: Lang, depth: number): string {
  const hit = exact[lang].get(text);
  if (hit !== undefined) return hit;
  if (depth < 3) {
    for (const r of rules[lang]) {
      const m = text.match(r.re);
      if (!m) continue;
      return r.out.replace(/\u0000(\d)\u0000/g, (_, n) => {
        const part = m[Number(n)] ?? "";
        return tr(part, lang, depth + 1);
      });
    }
  }
  const [re, map] = MONTHS[lang];
  return text.replace(re, (_, d, mo, y) => `${d} ${map[mo]} ${y}`);
}

/** Terjemahkan satu potong teks (spasi di tepi dipertahankan). */
export function tr(text: string, lang: Lang, depth = 0): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m || !m[2]) return text;
  return m[1] + core(m[2].replace(/\s+/g, " "), lang, depth) + m[3];
}
