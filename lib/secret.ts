import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Enkripsi sederhana untuk rahasia yang disimpan di database (mis. password server pada Services): AES-256-GCM.
 * Kunci diturunkan dari SERVICE_SECRET (atau AUTH_SECRET bila tidak diisi) — jangan mengganti nilainya setelah ada data,
 * karena rahasia lama tidak bisa dibuka lagi.
 */
const key = () => createHash("sha256").update(process.env.SERVICE_SECRET || process.env.AUTH_SECRET || "").digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(packed: string): string | null {
  try {
    const [iv, tag, enc] = packed.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
