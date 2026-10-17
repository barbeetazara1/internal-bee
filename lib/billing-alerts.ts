import { prisma } from "./db";
import { fmtDate } from "./format";
import { DUE_SOON_DAYS, EXPIRING_DAYS } from "./services";

const DAY = 86400000;
const OVERDUE = "⚠️ Overdue";
const SOON = "⏰ Due soon";
const RENEW = "🔁 Renewal needed";

/**
 * Pengingat tagihan/layanan (sekali per bill & jenis, tidak berulang): tagihan jatuh tempo ≤ 7 hari, tagihan terlambat,
 * dan layanan yang periode terakhirnya segera berakhir. Dikirim sebagai notifikasi ke owner & sales person lead
 * (atau Super Admin bila tidak ada) dan tercatat di riwayat bill/layanan. Aman dijalankan berulang (dedupe lewat riwayat).
 */
export async function runBillingAlerts(now = new Date()) {
  let created = 0;
  const admins = (await prisma.user.findMany({ where: { is_active: true, role: "SUPER_ADMIN" }, select: { id: true } })).map((u) => u.id);

  const bills = await prisma.bill.findMany({
    relationLoadStrategy: "join",
    where: { status: "UNPAID", due_date: { lte: new Date(now.getTime() + DUE_SOON_DAYS * DAY) } },
    include: { service: true, lead: { select: { owner_id: true, sales_persons: { select: { id: true } } } } },
  });
  const send = async (rec: { type: "bill" | "service"; id: string; label: string }, body: string, marker: string, authorId: string, users: string[]) => {
    if (await prisma.activity.count({ where: { record_type: rec.type, record_id: rec.id, kind: "ALERT", body: { startsWith: marker } } })) return;
    const a = await prisma.activity.create({ data: { record_type: rec.type, record_id: rec.id, kind: "ALERT", body, author_id: authorId, record_label: rec.label } });
    const to = [...new Set(users)];
    if (to.length) await prisma.notification.createMany({ data: to.map((user_id) => ({ user_id, activity_id: a.id })) });
    created++;
  };
  const who = (l: { owner_id: string; sales_persons: { id: string }[] }) => [...new Set([l.owner_id, ...l.sales_persons.map((u) => u.id)])];

  for (const b of bills) {
    const overdue = b.due_date.getTime() < now.getTime();
    const svc = b.service;
    const days = Math.ceil((b.due_date.getTime() - now.getTime()) / DAY);
    const risk = svc ? (b.period_no === 1 && !svc.active_until ? ` The service "${svc.name}" is not active until this is paid.` : ` The service "${svc.name}" may stop${svc.active_until ? ` after ${fmtDate(svc.active_until)}` : ""} if unpaid.`) : "";
    const what = svc ? `${b.code} (${svc.name}, payment ${b.period_no}/${b.period_total})` : `${b.code} (payment ${b.period_no}/${b.period_total})`;
    const body = overdue ? `${OVERDUE} — ${what} was due ${fmtDate(b.due_date)} and is still unpaid.${risk}` : `${SOON} — ${what} is due ${fmtDate(b.due_date)} (${days} day(s)).${risk}`;
    const users = who(b.lead).length ? who(b.lead) : admins;
    await send({ type: "bill", id: b.id, label: b.code }, body, overdue ? OVERDUE : SOON, b.lead.owner_id, users);
  }

  // Layanan yang periode terakhirnya sudah terbayar dan masa aktifnya segera habis → perlu perpanjangan (tidak ada tagihan berikutnya)
  const ending = await prisma.service.findMany({
    relationLoadStrategy: "join",
    where: { billing: { not: "ONE_TIME" }, active_until: { gt: now, lte: new Date(now.getTime() + EXPIRING_DAYS * DAY) } },
    include: { lead: { select: { owner_id: true, sales_persons: { select: { id: true } } } } },
  });
  for (const s of ending.filter((x) => x.paid_periods >= x.periods)) {
    const users = who(s.lead).length ? who(s.lead) : admins;
    await send({ type: "service", id: s.id, label: s.name }, `${RENEW} — the last paid period of "${s.name}" ends ${fmtDate(s.active_until)}. There is no next bill; renew it to avoid downtime.`, RENEW, s.lead.owner_id, users);
  }
  return created;
}

let last = 0;
/** Dijalankan ringan dari layout aplikasi (maks. sekali per 30 menit per instance); jadwal harian utama lewat cron. */
export async function maybeRunBillingAlerts() {
  if (Date.now() - last < 30 * 60 * 1000) return;
  last = Date.now();
  try {
    await runBillingAlerts();
  } catch (e) {
    console.error("billing alerts failed", e);
  }
}
