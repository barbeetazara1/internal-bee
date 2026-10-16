import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { closeLeadAsWon } from "../lib/automation";
import { backfillActivities } from "../lib/activity";
import { DEFAULT_ACTIVITY_TYPES } from "../lib/activity-types";

const prisma = new PrismaClient();
const DEV_PASSWORD = "BeeDev#2026";

async function main() {
  const password_hash = await bcrypt.hash(DEV_PASSWORD, 10);
  const [admin, sales, pm] = await Promise.all(
    [
      { name: "Super Admin", email: "admin@internalbee.local", role: "SUPER_ADMIN" },
      { name: "Sari Sales", email: "sales@internalbee.local", role: "SALES" },
      { name: "Putra Project", email: "project@internalbee.local", role: "PROJECT" },
    ].map((u) => prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, password_hash } })),
  );

  const prod = async (code: string, name: string, license_type: string, rate: number, price: number, description: string) =>
    prisma.product.upsert({
      where: { code },
      update: {},
      create: { code, name, license_type, default_rate_limit: rate, base_price: price, description },
    });
  const ocr = await prod("PROD-OCR-01", "Internal Bee OCR API", "MONTHLY", 600, 15000000, "Ekstraksi teks & dokumen (KTP, NPWP, invoice).");
  const wa = await prod("PROD-WA-01", "Internal Bee WhatsApp Gateway", "MONTHLY", 300, 8000000, "Kirim notifikasi & OTP via WhatsApp.");
  const pos = await prod("PROD-POS-01", "Internal Bee POS Suite", "ONE_TIME", 1200, 45000000, "Aplikasi kasir terintegrasi multi-cabang.");
  await prod("PROD-AI-01", "Internal Bee AI Assistant", "MONTHLY", 900, 25000000, "Chatbot & asisten AI untuk customer service.");

  // Master Activity Type (idempoten: hanya menambah yang belum ada, tidak menimpa perubahan Super Admin)
  for (const [i, t] of DEFAULT_ACTIVITY_TYPES.entries()) {
    await prisma.activityType.upsert({ where: { name: t.name }, update: {}, create: { name: t.name, icon: t.icon, sort: i, needs_location: !!t.needs_location } });
  }

  if ((await prisma.lead.count()) > 0) {
    await backfillActivities();
    return console.log("Seed: data lead sudah ada, dilewati.");
  }

  const clientOf = async (name: string, contact: string) => {
    const found = await prisma.client.findFirst({ where: { name } });
    if (found) return found;
    const n = (await prisma.client.count()) + 1;
    return prisma.client.create({ data: { code: `CLI-${String(n).padStart(4, "0")}`, name, contact_name: contact, email: `${contact.split(" ")[0].toLowerCase()}@${name.split(" ")[1]?.toLowerCase() ?? "example"}.co.id` } });
  };
  const mk = async (title: string, company: string, contact_name: string, status: string, items: [string, number, number, number, string][]) => {
    const client = await clientOf(company, contact_name);
    return prisma.lead.create({
      data: {
        title, client_id: client.id, contact_name, status, owner_id: sales.id, email: client.email,
        source: "Referral",
        products: { create: items.map(([product_id, quantity, price, license_months, environment]) => ({ product_id, quantity, price, license_months, environment })) },
      },
    });
  };

  await mk("Paket OCR untuk verifikasi KYC", "PT Nusantara Finansial", "Budi Santoso", "NEGOTIATION", [[ocr.id, 1, 12500000, 12, "PRODUCTION"]]);
  await mk("WA Gateway notifikasi order", "CV Maju Jaya", "Rina Wijaya", "PROPOSAL", [[wa.id, 1, 7500000, 6, "SANDBOX"]]);
  await mk("Eksplorasi POS multi-cabang", "PT Kopi Kenangan Baru", "Dimas Aryo", "QUALIFIED", []);
  await mk("Chatbot CS", "PT Telko Digital", "Maya Putri", "NEW", []);
  const won = await mk("OCR + WhatsApp untuk fintech", "PT Bank Digital Sejahtera", "Agus Hartono", "NEGOTIATION", [
    [ocr.id, 2, 14000000, 12, "PRODUCTION"],
    [wa.id, 1, 7000000, 12, "PRODUCTION"],
  ]);

  const wonLines = await prisma.leadProduct.findMany({ where: { lead_id: won.id } });
  const { clientId } = await closeLeadAsWon(won.id, sales.id, Object.fromEntries(wonLines.map((l) => [l.id, { kind: "FULL" as const }])));

  // Progres task & contoh pemakaian API agar halaman terlihat hidup
  const tasks = await prisma.task.findMany({ where: { project: { client_id: clientId } }, orderBy: { start_date: "asc" } });
  for (const [i, t] of tasks.entries()) {
    const status = i === 0 ? "DONE" : i < 3 ? "IN_PROGRESS" : i === 3 ? "IN_REVIEW" : "TODO";
    await prisma.task.update({ where: { id: t.id }, data: { status, assignee_id: i % 2 ? pm.id : admin.id } });
  }
  const keys = await prisma.apiKey.findMany({ where: { client_id: clientId } });
  const logs = [];
  for (const k of keys) {
    for (let d = 0; d < 14; d++) {
      const n = Math.floor(Math.random() * 40) + 5;
      for (let j = 0; j < n; j++) {
        logs.push({ api_key_id: k.id, endpoint: "/api/v1/verify", status_code: Math.random() > 0.05 ? 200 : 429, created_at: new Date(Date.now() - d * 86400000 - Math.random() * 40000000) });
      }
    }
  }
  await prisma.usageLog.createMany({ data: logs });
  await backfillActivities();
  console.log(`Seed selesai. Login: admin@internalbee.local / sales@internalbee.local / project@internalbee.local — password dev: ${DEV_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
