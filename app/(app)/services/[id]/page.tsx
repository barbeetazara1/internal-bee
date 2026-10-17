import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { Badge, Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import Section from "@/components/Section";
import ChatterSection from "@/components/ChatterSection";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { ServiceSecretField } from "@/components/StoredSecret";
import { saveServiceDetails } from "@/app/actions/services";
import { ADDON_BILLING_LABEL, ADDON_KIND_LABEL } from "@/lib/addons";
import { SERVICE_STATE_LABEL, SERVICE_STATE_TONE, serviceState } from "@/lib/services";
import { BILL_LABEL, effectiveBillStatus } from "@/lib/constants";
import { fmtDate, idr } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await prisma.service.findUnique({ relationLoadStrategy: "join", where: { id }, include: { client: true, lead: true, bills: { orderBy: { period_no: "asc" } } } });
  if (!s) notFound();
  const now = new Date();
  const unpaid = s.bills.filter((b) => b.status === "UNPAID").sort((a, b) => a.due_date.getTime() - b.due_date.getTime())[0] ?? null;
  const state = serviceState(s, unpaid?.due_date ?? null, now);
  const canBills = can.manageBills(user.role);
  const left = s.active_until ? Math.ceil((s.active_until.getTime() - now.getTime()) / 86400000) : null;
  const warn =
    state === "DOWN" ? `Masa aktif sudah habis pada ${fmtDate(s.active_until)} dan periode berikutnya belum dibayar. Layanan kemungkinan sudah terhenti.`
    : state === "AT_RISK" ? `Tagihan ${unpaid?.code} jatuh tempo ${fmtDate(unpaid?.due_date)} dan belum dibayar. ${s.active_until ? `Layanan aktif sampai ${fmtDate(s.active_until)}; lewat itu bisa terhenti.` : "Layanan belum aktif."}`
    : state === "EXPIRING" ? `${unpaid ? `Tagihan ${unpaid.code} jatuh tempo ${fmtDate(unpaid.due_date)}. ` : ""}Masa aktif tersisa ${left} hari${s.paid_periods >= s.periods ? " dan ini periode terakhir — perlu perpanjangan." : "."}`
    : state === "ENDED" ? "Semua periode sudah terbayar dan masa aktif telah selesai. Perpanjang bila client masih membutuhkan layanan ini."
    : null;
  const infra = can.manageProjects(user.role); // akses server (IP/port/user/password) hanya Super Admin & Project
  const L = {
    HOSTING: { provider: "Dibeli / disewa di", domain: "Domain / hostname" },
    DOMAIN: { provider: "Dibeli di (registrar)", domain: "Nama domain" },
    SSL: { provider: "Penerbit / dibeli di", domain: "Domain yang dilindungi" },
    MAINTENANCE: { provider: "Vendor / penyedia", domain: "Domain terkait" },
    OTHER: { provider: "Vendor / penyedia", domain: "Domain terkait" },
  }[s.kind as "HOSTING" | "DOMAIN" | "SSL" | "MAINTENANCE" | "OTHER"] ?? { provider: "Vendor / penyedia", domain: "Domain terkait" };
  return (
    <RecordProvider listHref="/services">
    <div>
      <Breadcrumb items={[{ label: "Services", href: "/services" }, { label: s.name }]} />
      <PageHeader title={`${s.name} — ${s.client.name}`} subtitle={`${ADDON_KIND_LABEL[s.kind] ?? s.kind} · ${s.lead.title}`} />
      {infra && <RecordBar />}
      {warn && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${state === "EXPIRING" || state === "ENDED" ? "border-amber-300 bg-amber-500/10 text-amber-700" : "border-red-300 bg-red-500/10 text-red-700"}`}>{warn}</div>}
      <div className="space-y-6">
        <Section title="Informasi Layanan" subtitle="Layanan berjalan dari add-on lead">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Status"><Badge tone={SERVICE_STATE_TONE[state]}>{SERVICE_STATE_LABEL[state]}</Badge></Field>
            <Field label="Client"><Link href={`/clients/${s.client_id}`} className="font-medium hover:underline">{s.client.name}</Link></Field>
            <Field label="Lead">{canBills ? <Link href={`/leads/${s.lead_id}`} className="hover:underline">{s.lead.title}</Link> : s.lead.title}</Field>
            <Field label="Jenis">{ADDON_KIND_LABEL[s.kind] ?? s.kind}</Field>
            <Field label="Penagihan">{ADDON_BILLING_LABEL[s.billing] ?? s.billing}</Field>
            <Field label="Biaya per periode">{idr(Number(s.amount))}</Field>
            <Field label="Periode terbayar">{`${s.paid_periods} dari ${s.periods}`}</Field>
            <Field label="Aktif sampai">{s.active_until ? <>{fmtDate(s.active_until)} <span className="text-xs text-slate-400">({left! < 0 ? `lewat ${-left!} hari` : `${left} hari lagi`})</span></> : s.billing === "ONE_TIME" && s.paid_periods > 0 ? "Tanpa batas (sekali bayar)" : "Belum aktif"}</Field>
          </div>
        </Section>
        <RecordForm action={saveServiceDetails} locked={!infra} className="fields-compact">
          <input type="hidden" name="id" value={s.id} />
          <Section title="Detail Layanan" subtitle={s.kind === "HOSTING" ? "Vendor, domain, dan akses server" : s.kind === "DOMAIN" ? "Registrar dan nama domain" : s.kind === "SSL" ? "Penerbit sertifikat dan domain yang dilindungi" : "Vendor dan catatan"}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <div><label className="label">{L.provider}</label><input name="provider" maxLength={120} defaultValue={s.provider ?? ""} className="input" placeholder={s.kind === "DOMAIN" ? "Mis. Niagahoster, Namecheap" : s.kind === "HOSTING" ? "Mis. AWS, DigitalOcean, Biznet Gio" : "Mis. Let's Encrypt, Sectigo"} /></div>
              <div><label className="label">{L.domain}</label><input name="domain_name" maxLength={253} defaultValue={s.domain_name ?? ""} className="input" placeholder="contoh.co.id" /></div>
              {s.kind === "HOSTING" && infra && (
                <>
                  <div><label className="label">IP Server</label><input name="server_ip" maxLength={100} defaultValue={s.server_ip ?? ""} className="input" placeholder="Mis. 103.12.34.56" /></div>
                  <div><label className="label">Port</label><input name="server_port" inputMode="numeric" maxLength={5} defaultValue={s.server_port ?? ""} className="input" placeholder="Mis. 22" /></div>
                  <div><label className="label">User</label><input name="server_user" maxLength={120} defaultValue={s.server_user ?? ""} className="input" placeholder="Mis. root" autoComplete="off" /></div>
                  <div><label className="label">Password</label><ServiceSecretField serviceId={s.id} has={!!s.secret_enc} /></div>
                </>
              )}
              <div className="md:col-span-2"><label className="label">Catatan</label><textarea name="notes" rows={3} maxLength={2000} defaultValue={s.notes ?? ""} className="input" placeholder="Mis. spesifikasi, lokasi data center, kontak vendor" /></div>
            </div>
            {s.kind === "HOSTING" && !infra && <p className="mt-3 text-xs text-slate-400">Akses server (IP, port, user, password) hanya terlihat oleh Super Admin dan Project.</p>}
          </Section>
        </RecordForm>
        <Section title="Tagihan Layanan" subtitle="Tagihan dibuat satu per satu: periode berikutnya muncul setelah yang sebelumnya dibayar" flush>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="th">Bill</th><th className="th">Periode</th><th className="th">Cakupan</th><th className="th">Jatuh Tempo</th><th className="th text-right">Jumlah</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {s.bills.map((b) => (
                <tr key={b.id}>
                  <td className="td font-mono text-xs">{canBills ? <Link href={`/bills/${b.id}`} className="hover:underline">{b.code}</Link> : b.code}</td>
                  <td className="td">{b.period_no} / {b.period_total}</td>
                  <td className="td">{b.period_start && b.period_end ? `${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}` : "—"}</td>
                  <td className="td">{fmtDate(b.due_date)}</td>
                  <td className="td text-right">{idr(Number(b.amount))}</td>
                  <td className="td"><StatusBadge status={effectiveBillStatus(b)} /></td>
                </tr>
              ))}
              {s.paid_periods + s.bills.filter((b) => b.status !== "PAID").length < s.periods && (
                <tr><td colSpan={6} className="px-4 py-3 text-xs text-slate-400">Periode berikutnya ({s.bills.length + 1 === s.periods ? s.periods : `${s.bills.length + 1}–${s.periods}`}) dibuat otomatis setelah tagihan di atas dibayar.</td></tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>
      <ChatterSection type="service" id={s.id} label={s.name} />
    </div>
    </RecordProvider>
  );
}
