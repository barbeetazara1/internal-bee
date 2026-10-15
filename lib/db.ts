import { PrismaClient } from "@prisma/client";

/**
 * Pooler Supabase/PgBouncer (mode Transaction, port 6543) tidak mendukung prepared statement. Tanpa `pgbouncer=true`
 * Prisma gagal dengan `prepared statement "s0" already exists`. Parameter ditambahkan otomatis di sini supaya
 * DATABASE_URL yang lupa memuatnya tetap bekerja (dan `connection_limit=1` untuk serverless).
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const pooled = u.hostname.includes("pooler.") || u.port === "6543";
    if (pooled && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (pooled && process.env.VERCEL && !u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return raw;
  }
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
