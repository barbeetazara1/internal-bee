import { createHash, randomBytes } from "crypto";

export type Env = "SANDBOX" | "PRODUCTION";

export const hashKey = (plain: string) => createHash("sha256").update(plain).digest("hex");

/** Membangkitkan API key baru. Plaintext hanya dikembalikan sekali; DB hanya menyimpan hash. */
export function generateKey(env: Env) {
  const prefix = env === "PRODUCTION" ? "ib_live_" : "ib_test_";
  const plain = prefix + randomBytes(24).toString("base64url");
  return { plain, prefix, hash: hashKey(plain), hint: plain.slice(-4) };
}

/** Status efektif: key ACTIVE yang sudah lewat expires_at dianggap EXPIRED. */
export function effectiveStatus(k: { status: string; expires_at: Date | null }) {
  if (k.status === "ACTIVE" && k.expires_at && k.expires_at.getTime() < Date.now()) return "EXPIRED";
  return k.status;
}
