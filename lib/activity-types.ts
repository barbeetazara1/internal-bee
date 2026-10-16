/**
 * Nilai awal master Activity Type untuk pipeline sales software/API licensing (urut kira-kira mengikuti tahap lead).
 * Dipakai seed; setelah itu Super Admin mengelolanya di Settings → Activity Types.
 */
export const DEFAULT_ACTIVITY_TYPES: { name: string; icon: string; needs_location?: boolean }[] = [
  { name: "Call", icon: "phone" },                  // telepon pertama / follow-up cepat
  { name: "Email", icon: "mail" },                  // korespondensi resmi, kirim materi
  { name: "WhatsApp / Chat", icon: "chat" },        // kanal paling umum di Indonesia
  { name: "Meeting", icon: "users", needs_location: true },               // tatap muka / online (kebutuhan, diskusi teknis)
  { name: "Product Demo", icon: "demo", needs_location: true },           // demo aplikasi / sandbox ke client
  { name: "Site Visit", icon: "pin", needs_location: true },              // kunjungan ke lokasi client
  { name: "Send Proposal", icon: "file" },          // kirim proposal / penawaran harga
  { name: "Negotiation", icon: "handshake" },       // negosiasi harga, termin, masa lisensi
  { name: "Send Contract", icon: "signature" },     // kontrak / dokumen legal & tanda tangan
  { name: "Follow-up", icon: "bell" },              // pengingat menindaklanjuti tanpa respons
  { name: "To-Do", icon: "check" },                 // tugas internal bebas
];

/** Pilihan ikon untuk master Activity Type: kunci → label. Ikon sebenarnya dipetakan di komponen UI. */
export const ACTIVITY_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "phone", label: "Telepon" },
  { value: "mail", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "users", label: "Meeting" },
  { value: "demo", label: "Demo" },
  { value: "pin", label: "Lokasi" },
  { value: "file", label: "Dokumen" },
  { value: "handshake", label: "Negosiasi" },
  { value: "signature", label: "Kontrak" },
  { value: "bell", label: "Pengingat" },
  { value: "check", label: "To-Do" },
];
