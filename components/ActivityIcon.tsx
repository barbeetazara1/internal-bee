import { Bell, FileSignature, FileText, Handshake, ListChecks, MapPin, MessageCircle, Mail, MonitorPlay, Phone, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  phone: Phone, mail: Mail, chat: MessageCircle, users: Users, demo: MonitorPlay, pin: MapPin,
  file: FileText, handshake: Handshake, signature: FileSignature, bell: Bell, check: ListChecks,
};

/** Ikon jenis activity (kunci dari master Activity Type). */
export default function ActivityIcon({ name, size = 15, className = "" }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? ListChecks;
  return <Icon size={size} className={className} />;
}
