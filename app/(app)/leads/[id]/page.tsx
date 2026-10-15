import Link from "next/link";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Alert, Breadcrumb, PageHeader, StatusBadge } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ConfirmButton from "@/components/ConfirmButton";
import Select from "@/components/Select";
import ClientPicker from "@/components/ClientPicker";
import PhoneInput from "@/components/PhoneInput";
import LeadLines from "@/components/LeadLines";
import Section from "@/components/Section";
import LeadStatusProgress, { type Step } from "@/components/LeadStatusProgress";
import { fmtDate } from "@/lib/format";
import { LEAD_FINAL, LEAD_LABEL, LEAD_STATUSES, leadDetailLocked, leadProductsLocked, licenseTypeOf } from "@/lib/constants";
import PaymentDialog from "@/components/PaymentDialog";
import { closeWon, setLeadPayment, setLeadStatus, updateLead } from "@/app/actions/leads";

/** Mulai tahap Qualified, lead wajib sudah punya produk. */
const needsProduct = (s: string) => (LEAD_STATUSES as readonly string[]).indexOf(s) >= 2;
const noProductsFor = (count: number, next: string) => count === 0 && needsProduct(next);

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireRole("SUPER_ADMIN", "SALES");
  const { id } = await params;
  const sp = await searchParams;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true, products: { include: { product: true }, orderBy: { product: { code: "asc" } } }, client: true, project: true, _count: { select: { bills: true } } },
  });
  if (!lead) notFound();
  const events = await prisma.activity.findMany({ where: { record_type: "lead", record_id: id, kind: "EVENT", body: { startsWith: "Status changed" } }, orderBy: { created_at: "asc" } });
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
  const next = !isFinal && lead.status !== "NEGOTIATION" ? flow[flow.indexOf(lead.status) + 1] : null;
  const nextBlocked = !!next && noProductsFor(lead.products.length, next);

  const clientOptions = (await prisma.client.findMany({ orderBy: { name: "asc" } })).map((c) => ({ value: c.id, label: c.name, contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone ?? "" }));
  const products = await prisma.product.findMany({ where: { is_active: true }, orderBy: { code: "asc" } });
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
      <Breadcrumb items={[{ label: "Leads (CRM)", href: "/leads" }, { label: lead.title }]} />
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
                    disabled={nextBlocked}
                    tooltip={nextBlocked ? "Tambahkan minimal 1 produk dan Save sebelum lanjut ke tahap ini" : undefined}
                    className="btn"
                  >
                    → {LEAD_LABEL[next]}
                  </ConfirmButton>
                </form>
              )}
              {lead.status === "NEGOTIATION" && (
                <PaymentDialog
                  leadId={lead.id}
                  lines={payLines}
                  action={closeWon}
                  trigger="✓ Closed Won"
                  triggerClassName="btn border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
                  title="Tutup sebagai Closed Won?"
                  intro="Atur sistem pembayarannya. Setelah ditutup, sistem otomatis membuat Project beserta task board, API Key untuk tiap produk, dan Bills sesuai pilihan di bawah. Lead tidak bisa dikembalikan ke status sebelumnya."
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
        <Section title="Detail Lead" subtitle="Informasi peluang dan kontak">
        <input type="hidden" name="id" value={lead.id} />
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {/* Kolom kiri, atas ke bawah */}
          <div className="space-y-2">
            <div><label className="label">Judul</label><input name="title" defaultValue={lead.title} className="input" /></div>
            <div><label className="label">Client<span className="text-red-500"> *</span></label><ClientPicker options={clientOptions} defaultValue={lead.client_id} /></div>
            <div><label className="label">Nama kontak<span className="text-red-500"> *</span></label><input name="contact_name" required defaultValue={lead.contact_name} className="input" /></div>
            <div><label className="label">Email</label><input name="email" defaultValue={lead.email ?? ""} className="input" /></div>
          </div>
          {/* Kolom kanan, atas ke bawah */}
          <div className="space-y-2">
            <div><label className="label">Telepon<span className="text-red-500"> *</span></label><PhoneInput name="phone" required defaultValue={lead.phone ?? ""} className="input" /></div>
            <div><label className="label">Sumber</label><input name="source" defaultValue={lead.source ?? ""} className="input" /></div>
          </div>
          {/* Paling bawah, selebar kartu */}
          <div className="md:col-span-2"><label className="label">Catatan</label><textarea name="notes" defaultValue={lead.notes ?? ""} rows={2} className="input" /></div>
        </div>
        </Section>
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
      <ChatterSection type="lead" id={lead.id} label={lead.title} />
    </div>
    </RecordProvider>
  );
}
