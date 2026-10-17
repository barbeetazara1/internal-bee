import Link from "next/link";
import { Printer } from "lucide-react";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Alert, Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import LeadActivities from "@/components/LeadActivities";
import MultiSelect from "@/components/MultiSelect";
import { SALES_ROLES } from "@/lib/sales";
import ChatterSection from "@/components/ChatterSection";
import ConfirmButton from "@/components/ConfirmButton";
import Select from "@/components/Select";
import ClientPicker from "@/components/ClientPicker";
import PhoneInput from "@/components/PhoneInput";
import LeadLines from "@/components/LeadLines";
import LeadAddons from "@/components/LeadAddons";
import Section from "@/components/Section";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import { fmtDate } from "@/lib/format";
import { LEAD_FINAL, LEAD_LABEL, LEAD_STATUSES, PRIORITY_OPTIONS, leadDetailLocked, leadProductsLocked, licenseTypeOf } from "@/lib/constants";
import PaymentDialog from "@/components/PaymentDialog";
import { closeWon, setLeadPayment, setLeadStatus, updateLead } from "@/app/actions/leads";

/** Mulai tahap Qualified, lead wajib sudah punya produk. */
const needsProduct = (s: string) => (LEAD_STATUSES as readonly string[]).indexOf(s) >= 2;
const noProductsFor = (count: number, next: string) => count === 0 && needsProduct(next);

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const sp = await searchParams;
  const lead = await prisma.lead.findUnique({ relationLoadStrategy: "join",
    where: { id },
    include: { owner: true, addons: true, sales_persons: { select: { id: true, name: true } }, products: { include: { product: true }, orderBy: { product: { code: "asc" } } }, client: true, project: true, _count: { select: { bills: true } } },
  });
  if (!lead) notFound();
  const [activities, actTypes, salesUsers, events, clients, products, addonCatalog] = await Promise.all([
    prisma.leadActivity.findMany({ where: { lead_id: id }, include: { type: true, created_by: { select: { name: true } }, sales_persons: { select: { id: true, name: true } } }, orderBy: { scheduled_at: "asc" } }),
    prisma.activityType.findMany({ where: { is_active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { is_active: true, role: { in: SALES_ROLES } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.activity.findMany({ where: { record_type: "lead", record_id: id, kind: "EVENT", body: { startsWith: "Status changed" } }, orderBy: { created_at: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { is_active: true }, orderBy: { code: "asc" } }),
    prisma.addon.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }] }),
  ]);
  const byLabel = Object.fromEntries(Object.entries(LEAD_LABEL).map(([k, v]) => [v, k]));
  const reachedAt: Record<string, Date> = { NEW: lead.created_at };
  let lostFrom: string | null = null;
  for (const e of events) {
    const m = /^Status changed: (.+) → (.+)$/.exec(e.body ?? "");
    if (m && byLabel[m[2]]) {
      reachedAt[byLabel[m[2]]] = e.created_at;
      if (byLabel[m[2]] === "CLOSED_LOST") lostFrom = byLabel[m[1]] ?? null;
    } else if ((e.body ?? "").startsWith("Status changed to Closed Won")) reachedAt["CLOSED_WON"] = e.created_at;
  }
  const order = LEAD_STATUSES as readonly string[];
  const flow = order.filter((x) => !(LEAD_FINAL as readonly string[]).includes(x)); // Baru … Negosiasi
  const finalStep = lead.status === "CLOSED_LOST" ? "CLOSED_LOST" : "CLOSED_WON";
  const curIdx = order.indexOf(lead.status);
  // Closed Lost di tengah jalan: tahap setelah yang terakhir dicapai disembunyikan (mis. Baru → … → Qualified → Closed Lost).
  const maxReached = Math.max(0, ...flow.map((st, i) => (reachedAt[st] ? i : -1)), lostFrom ? flow.indexOf(lostFrom) : -1);
  const visibleFlow = lead.status === "CLOSED_LOST" ? flow.slice(0, maxReached + 1) : flow;
  const steps: Step[] = [...visibleFlow, finalStep].map((st) => {
    const i = order.indexOf(st);
    const state: Step["state"] = st === lead.status ? "current" : lead.status === "CLOSED_LOST" || i < curIdx ? "done" : "todo";
    return { status: st, label: LEAD_LABEL[st], state, date: reachedAt[st] ? fmtDate(reachedAt[st]) : null };
  });
  const isFinal = (LEAD_FINAL as readonly string[]).includes(lead.status);
  const openActs = activities.filter((a) => a.stage === lead.status && a.status !== "DONE").length; // wajib selesai sebelum pindah tahap
  const actDto = activities.map((a) => ({ id: a.id, title: a.title || a.type.name, location: a.location, type_id: a.type_id, duration: a.duration_minutes, sales: a.sales_persons, type: a.type.name, icon: a.type.icon, stage: a.stage, scheduled_at: a.scheduled_at.toISOString(), notes: a.notes, status: a.status, by: a.created_by.name }));
  const next = !isFinal && lead.status !== "NEGOTIATION" ? flow[flow.indexOf(lead.status) + 1] : null;
  const nextBlocked = !!next && noProductsFor(lead.products.length, next);

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }));
  const locked = lead.status === "CLOSED_WON";
  const detailLocked = leadDetailLocked(lead.status);
  const productsLocked = leadProductsLocked(lead.status);
  const noProducts = lead.products.length === 0;
  const payLines = lead.products.map((p) => ({ id: p.id, label: `${p.product.code} — ${p.product.name}`, price: Number(p.price), license_type: licenseTypeOf(p.license_months) }));
  const needsPayment = lead.status === "CLOSED_WON" && lead._count.bills === 0;
  const productOptions = [...products, ...lead.products.map((lp) => lp.product).filter((p) => !products.some((x) => x.id === p.id))].map((p) => ({ value: p.id, label: `${p.code} — ${p.name}`, price: Number(p.base_price), license_type: p.license_type }));

  return (
    <RecordProvider listHref="/leads">
    <div>
      <Breadcrumb items={[{ label: "Opportunities" }, { label: "Leads", href: "/leads" }, { label: lead.title }]} />
      <PageHeader title={lead.title} subtitle={`${lead.client.name} · owner ${lead.owner.name}`} />
      <RecordBar
        createHref="/leads/new"
        right={<LeadStatusProgress steps={steps} />}
        extra={
          !isFinal && (
            <>
              {next && (
                <form action={setLeadStatus}>
                  <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="status" value={next} />
                  <ConfirmButton
                    title={`Pindah ke ${LEAD_LABEL[next]}?`}
                    confirmLabel={`Ya, ${LEAD_LABEL[next]}`}
                    message="Status hanya bisa maju dan tidak bisa dikembalikan ke tahap sebelumnya."
                    disabled={nextBlocked || openActs > 0}
                    tooltip={openActs > 0 ? `Selesaikan ${openActs} activity di tahap ini dulu` : nextBlocked ? "Tambahkan minimal 1 produk dan Save sebelum lanjut ke tahap ini" : undefined}
                    className="btn"
                  >
                    → {LEAD_LABEL[next]}
                  </ConfirmButton>
                </form>
              )}
              {lead.status === "PROPOSAL" && (
                <Link href={`/leads/${lead.id}/proposal`} className="btn"><Printer size={15} /> Print Proposal</Link>
              )}
              {lead.status === "NEGOTIATION" && (
                <PaymentDialog
                  leadId={lead.id}
                  lines={payLines}
                  action={closeWon}
                  trigger="✓ Closed Won"
                  triggerClassName="btn border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
                  triggerDisabled={openActs > 0}
                  triggerTitle={openActs > 0 ? `Selesaikan ${openActs} activity di tahap ini dulu` : undefined}
                  title="Tutup sebagai Closed Won?"
                  intro={`Atur sistem pembayarannya. Setelah ditutup, sistem otomatis membuat Project beserta task board, API Key untuk tiap produk, dan Bills sesuai pilihan di bawah.${lead.addons.some((a) => !a.client_managed) ? " Add-on yang berbayar ikut ditagih otomatis sesuai periodenya." : ""} Lead tidak bisa dikembalikan ke status sebelumnya.`}
                  confirmLabel="Ya, Closed Won"
                />
              )}
              <form action={setLeadStatus}>
                <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="status" value="CLOSED_LOST" />
                <ConfirmButton danger title="Tandai sebagai Closed Lost?" confirmLabel="Ya, Closed Lost" message="Lead ini dianggap gagal dan statusnya tidak bisa dikembalikan ke tahap sebelumnya." className="btn border-red-600 bg-red-600 text-white hover:bg-red-500">
                  ✕ Closed Lost
                </ConfirmButton>
              </form>
            </>
          )
        }
      />
      {sp.error && <Alert>{sp.error}</Alert>}
      {locked && lead.client && (
        <Alert tone="green">
          Deal ditutup. Client <Link className="font-semibold underline" href={`/clients/${lead.client.id}`}>{lead.client.name}</Link>
          {lead.project && <> dan project <Link className="font-semibold underline" href={`/projects/${lead.project.id}`}>{lead.project.name}</Link></>} sudah dibuat otomatis.
        </Alert>
      )}

      {needsPayment && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>Lead ini belum punya sistem pembayaran, sehingga belum ada Bills.</span>
          <PaymentDialog
            leadId={lead.id}
            lines={payLines}
            action={setLeadPayment}
            trigger="Atur Pembayaran"
            triggerClassName="btn btn-primary btn-sm"
            title="Atur sistem pembayaran"
            intro="Pilih sistem pembayaran dan tanggal pembayaran pertama per produk. Pembayaran berikutnya dihitung otomatis dari tanggal itu."
            confirmLabel="Buat Bills"
          />
        </div>
      )}

      <RecordForm action={updateLead} locked={detailLocked} className="fields-compact">
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <Section title="Detail Lead" subtitle="Peluang, prioritas, dan sumbernya">
          <input type="hidden" name="id" value={lead.id} />
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Judul</label><input name="title" defaultValue={lead.title} className="input" /></div>
            {/* Prioritas boleh diubah kapan saja selama lead belum ditutup, walau detail lain sudah terkunci */}
            <div data-unlock={isFinal ? undefined : "1"}><label className="label">Prioritas</label><Select name="priority" options={PRIORITY_OPTIONS} defaultValue={lead.priority} /></div>
            <div><label className="label">Sumber</label><input name="source" defaultValue={lead.source ?? ""} className="input" /></div>
            {/* Sales Person (many2many): boleh diubah kapan saja selama lead belum ditutup */}
            <div className="sm:col-span-2" data-unlock={isFinal ? undefined : "1"}>
              <label className="label">Sales Person</label>
              <input type="hidden" name="sales_person_marker" value="1" />
              <MultiSelect name="sales_person_ids" options={[...salesUsers, ...lead.sales_persons.filter((p) => !salesUsers.some((u) => u.id === p.id))].map((u) => ({ value: u.id, label: u.name }))} defaultValue={lead.sales_persons.map((u) => u.id)} placeholder="Pilih sales person…" />
            </div>
            <div className="sm:col-span-2"><label className="label">Catatan</label><textarea name="notes" defaultValue={lead.notes ?? ""} rows={3} className="input" /></div>
          </div>
        </Section>
        <Section title="Detail Client" subtitle="Client dan kontak yang dihubungi">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Client<span className="text-red-500"> *</span></label><ClientPicker options={clientOptions} defaultValue={lead.client_id} /></div>
            <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required defaultValue={lead.contact_name} className="input" /></div>
            <div><label className="label">Telepon<span className="text-red-500"> *</span></label><PhoneInput name="phone" required defaultValue={lead.phone ?? ""} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Email</label><input name="email" defaultValue={lead.email ?? ""} className="input" /></div>
          </div>
        </Section>
        </div>
      </RecordForm>

      <div className="mt-6">
        <LeadLines
          key={lead.products.map((p) => `${p.id}:${p.quantity}:${p.price}:${p.license_months}:${p.environment}:${p.product_id}`).join("|")}
          locked={productsLocked}
          lockedNote={productsLocked ? "Produk terkunci karena lead sudah ditutup (Closed Won / Closed Lost)." : undefined}
          initial={lead.products.map((p) => ({ id: p.id, product_id: p.product_id, price: Number(p.price), environment: p.environment, license_type: licenseTypeOf(p.license_months) }))}
          products={productOptions}
        />
      </div>
        <div className="mt-6">
          <LeadAddons
            key={lead.addons.map((a) => `${a.id}:${a.price}:${a.billing}:${a.periods}:${a.quantity}:${a.client_managed}:${a.product_id}:${a.addon_id}`).join("|")}
            locked={productsLocked}
            initial={lead.addons.map((a) => ({ id: a.id, addon_id: a.addon_id, price: Number(a.price), billing: a.billing, periods: a.periods, quantity: a.quantity, client_managed: a.client_managed, product_id: a.product_id }))}
            addons={addonCatalog.filter((a) => a.is_active || lead.addons.some((l) => l.addon_id === a.id)).map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (nonaktif)`, price: Number(a.price), billing: a.billing }))}
            products={lead.products.map((lp) => ({ value: lp.product_id, label: lp.product.code }))}
          />
        </div>
      <LeadActivities
        leadId={lead.id}
        currentStage={lead.status}
        canAdd={!isFinal}
        types={actTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon, needs_location: t.needs_location }))}
        salesUsers={salesUsers}
        leadSales={lead.sales_persons}
        items={actDto.filter((a) => a.stage === lead.status)}
        history={actDto.filter((a) => a.stage !== lead.status)}
      />
      <ChatterSection type="lead" id={lead.id} label={lead.title} />
    </div>
    </RecordProvider>
  );
}
