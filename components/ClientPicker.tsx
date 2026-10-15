"use client";

import Select from "./Select";

export type ClientOpt = { value: string; label: string; contact_name: string; email: string; phone: string };

/**
 * Pilihan client (many2one). Begitu client dipilih, isian kontak (contact_name, email, phone)
 * di form yang sama terisi otomatis dari data client — tetap bisa diedit setelahnya.
 */
export default function ClientPicker({ options, defaultValue = "", name = "client_id" }: { options: ClientOpt[]; defaultValue?: string; name?: string }) {
  function fill(id: string) {
    const c = options.find((o) => o.value === id);
    const form = document.getElementById("record-form");
    if (!c || !form) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const [field, value] of [["contact_name", c.contact_name], ["email", c.email], ["phone", c.phone]] as const) {
      const el = form.querySelector<HTMLInputElement>(`input[name="${field}"]`);
      if (!el || el.disabled) continue;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  return <Select name={name} required searchable placeholder="Pilih client…" options={options} defaultValue={defaultValue} onChange={fill} />;
}
