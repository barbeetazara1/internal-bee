import { NextResponse } from "next/server";
import { can, getUser } from "@/lib/auth";
import { runBillingAlerts } from "@/lib/billing-alerts";

/**
 * Pengingat tagihan & layanan harian (Vercel Cron memanggil ini lewat vercel.json).
 * Bila CRON_SECRET terisi, Vercel mengirim header Authorization: Bearer <secret>; tanpa secret hanya Super Admin yang login yang boleh memanggil.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = secret ? req.headers.get("authorization") === `Bearer ${secret}` : (await getUser().then((u) => !!u && can.admin(u.role)));
  if (!ok) return new NextResponse("Forbidden", { status: 403 });
  const created = await runBillingAlerts();
  return NextResponse.json({ ok: true, created });
}
