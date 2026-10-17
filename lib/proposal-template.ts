// Isi & aturan template proposal (tanpa modul Node, aman dipakai di komponen klien)
/** Isi bawaan template proposal (dipakai selama user belum mengubahnya di Settings → Proposal). */
export const PROPOSAL_DEFAULTS = {
  company_name: "Internal Bee",
  tagline: "Software & API Licensing",
  title: "Proposal Penawaran",
  intro: "Yth. {contact},\n\nTerima kasih atas kesempatan yang diberikan kepada {company}. Bersama ini kami sampaikan proposal penawaran untuk {client} sebagai berikut.",
  scope: "Lisensi dan akses API sesuai produk pada tabel di atas, termasuk dukungan teknis selama masa lisensi berjalan.",
  terms: "Harga belum termasuk PPN.\nProposal ini berlaku sampai {valid_until}.\nSistem dan jadwal pembayaran mengikuti kesepakatan kedua belah pihak.",
  closing: "Demikian proposal ini kami sampaikan. Kami siap berdiskusi lebih lanjut untuk menyesuaikan kebutuhan {client}.",
  signer_name: "",
  signer_title: "Sales Executive",
  footer: "Dokumen ini dibuat otomatis oleh Internal Bee.",
  validity_days: 14,
};

export const PROPOSAL_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "{client}", label: "Nama client" },
  { key: "{contact}", label: "Nama kontak" },
  { key: "{lead}", label: "Judul lead" },
  { key: "{company}", label: "Nama perusahaan Anda" },
  { key: "{owner}", label: "Pemilik lead" },
  { key: "{date}", label: "Tanggal proposal" },
  { key: "{valid_until}", label: "Berlaku sampai" },
  { key: "{total}", label: "Total harga" },
];

/** Mengganti {placeholder} pada teks template dengan nilai lead. Placeholder yang tak dikenal dibiarkan apa adanya. */
export const fillTemplate = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** Template efektif: nilai tersimpan, atau bawaan bila kosong. */
export function resolveTemplate(s: Partial<Record<keyof typeof PROPOSAL_DEFAULTS, string | number | null>> | null) {
  const pick = (k: Exclude<keyof typeof PROPOSAL_DEFAULTS, "validity_days">) => (s?.[k] != null && String(s[k]).trim() !== "" ? String(s[k]) : (PROPOSAL_DEFAULTS[k] as string));
  return {
    company_name: pick("company_name"), tagline: pick("tagline"), title: pick("title"), intro: pick("intro"), scope: pick("scope"),
    terms: pick("terms"), closing: pick("closing"), signer_name: s?.signer_name != null ? String(s.signer_name) : "", signer_title: pick("signer_title"), footer: pick("footer"),
    validity_days: Number(s?.validity_days) > 0 ? Number(s?.validity_days) : PROPOSAL_DEFAULTS.validity_days,
  };
}

