"use client";

import Section from "./Section";
import Select from "./Select";
import { useLang } from "./I18nProvider";
import { LANGUAGES, type Lang } from "@/lib/lang";

export default function LanguageSettings() {
  const { lang, setLang } = useLang();
  return (
    <Section title="Bahasa" subtitle="Bahasa antarmuka">
      <div className="max-w-sm">
        <label className="label">Language</label>
        <Select name="language" options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} defaultValue={lang} onChange={(v) => setLang(v as Lang)} />
        <p className="mt-2 text-xs text-slate-400">Perubahan bahasa langsung diterapkan dan diingat di browser ini.</p>
      </div>
    </Section>
  );
}
