import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashKey } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limiter in-memory per key (req/menit). Cukup untuk dev lokal; ganti Redis untuk skala tinggi.
const g = globalThis as unknown as { __rl?: Map<string, { minute: number; count: number }> };
const buckets = (g.__rl ??= new Map());

async function handle(req: NextRequest) {
  const raw = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const endpoint = req.nextUrl.pathname;
  if (!raw || !/^ib_(live|test)_/.test(raw)) {
    return NextResponse.json({ valid: false, error: "missing_or_malformed_key" }, { status: 401 });
  }

  const key = await prisma.apiKey.findUnique({ relationLoadStrategy: "join", where: { key_hash: hashKey(raw) }, include: { product: true, client: true } });
  if (!key) return NextResponse.json({ valid: false, error: "invalid_key" }, { status: 401 });

  const log = (status: number) => prisma.usageLog.create({ data: { api_key_id: key.id, endpoint, status_code: status } });

  if (key.status === "SUSPENDED" || key.status === "REVOKED") {
    await log(403);
    return NextResponse.json({ valid: false, error: `key_${key.status.toLowerCase()}` }, { status: 403 });
  }
  if (key.status === "EXPIRED" || (key.expires_at && key.expires_at.getTime() < Date.now())) {
    if (key.status !== "EXPIRED") await prisma.apiKey.update({ where: { id: key.id }, data: { status: "EXPIRED" } });
    await log(403);
    return NextResponse.json({ valid: false, error: "key_expired" }, { status: 403 });
  }

  const minute = Math.floor(Date.now() / 60000);
  const b = buckets.get(key.id);
  if (!b || b.minute !== minute) buckets.set(key.id, { minute, count: 1 });
  else if (++b.count > key.rate_limit) {
    await log(429);
    return NextResponse.json({ valid: false, error: "rate_limit_exceeded", limit: key.rate_limit }, { status: 429, headers: { "Retry-After": "60" } });
  }

  await Promise.all([log(200), prisma.apiKey.update({ where: { id: key.id }, data: { last_used_at: new Date() } })]);
  return NextResponse.json({
    valid: true,
    client: key.client.name,
    product: { code: key.product.code, name: key.product.name },
    environment: key.environment,
    rate_limit_per_min: key.rate_limit,
    expires_at: key.expires_at,
  });
}

export const GET = handle;
export const POST = handle;
