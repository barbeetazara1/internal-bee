import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Bukti pembayaran disimpan di luar /public (storage/bill-proofs) dan hanya disajikan lewat route yang mengecek login & role. */
const DIR = path.join(process.cwd(), "storage", "bill-proofs");
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };

/** Jenis file sebenarnya dari isi (magic bytes), bukan dari nama/ekstensi yang bisa dipalsukan. */
export function sniff(buf: Buffer): string | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export async function saveProof(billId: string, buf: Buffer, type: string) {
  await mkdir(DIR, { recursive: true });
  const file = `${billId}-${randomBytes(6).toString("hex")}.${PROOF_TYPES[type]}`;
  await writeFile(path.join(DIR, file), buf, { mode: 0o600 });
  return file;
}

export const readProof = (file: string) => readFile(path.join(DIR, path.basename(file)));
export const removeProof = (file: string | null | undefined) => (file ? unlink(path.join(DIR, path.basename(file))).catch(() => {}) : Promise.resolve());
