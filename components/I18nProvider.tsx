"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { LANG_COOKIE, type Lang } from "@/lib/lang";

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: "id", setLang: () => {} });
export const useLang = () => useContext(LangCtx);

/**
 * Menerjemahkan seluruh UI di sisi klien: teks sumber di kode bercampur Indonesia/Inggris, jadi setiap node teks
 * (dan atribut placeholder/title/aria-label) dicocokkan dengan kamus. Node baru dari React/navigasi ikut diterjemahkan
 * lewat MutationObserver, dan ganti bahasa langsung berlaku tanpa refresh.
 */
export default function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const langRef = useRef<Lang>(initial);
  const origText = useRef(new WeakMap<Node, string>());
  const wroteText = useRef(new WeakMap<Node, string>());
  const origAttr = useRef(new WeakMap<Element, Record<string, string>>());
  const wroteAttr = useRef(new WeakMap<Element, Record<string, string>>());

  const text = useCallback((n: Node) => {
    const cur = n.nodeValue ?? "";
    const src = wroteText.current.get(n) === cur ? origText.current.get(n)! : cur;
    origText.current.set(n, src);
    const out = tr(src, langRef.current);
    wroteText.current.set(n, out);
    if (out !== cur) n.nodeValue = out;
  }, []);

  const attrs = useCallback((el: Element) => {
    const o = origAttr.current.get(el) ?? {};
    const w = wroteAttr.current.get(el) ?? {};
    for (const a of ATTRS) {
      const cur = el.getAttribute(a);
      if (cur === null) continue;
      const src = w[a] === cur ? o[a] : cur;
      o[a] = src;
      const out = tr(src, langRef.current);
      w[a] = out;
      if (out !== cur) el.setAttribute(a, out);
    }
    origAttr.current.set(el, o);
    wroteAttr.current.set(el, w);
  }, []);

  const walk = useCallback(
    (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return root.parentElement?.closest("[data-no-i18n]") ? undefined : text(root);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP.has(el.tagName) || el.closest("[data-no-i18n]")) return;
      attrs(el);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
    },
    [text, attrs],
  );

  // Terjemahkan setelah hidrasi, lalu pantau perubahan DOM.
  useEffect(() => {
    const root = document.body;
    walk(root);
    document.documentElement.removeAttribute("data-i18n");
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "childList") m.addedNodes.forEach((n) => walk(n));
        else if (m.type === "characterData") walk(m.target);
        else if (m.type === "attributes") attrs(m.target as Element);
      }
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => mo.disconnect();
  }, [walk, attrs]);

  const setLang = useCallback(
    (l: Lang) => {
      langRef.current = l;
      setLangState(l);
      try {
        document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      } catch {}
      document.documentElement.lang = l;
      walk(document.body);
    },
    [walk],
  );

  useLayoutEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}
