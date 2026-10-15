import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Bukti pembayaran tidak disimpan di database; hanya metadata-nya. Isi file disimpan di:
 *  - Vercel Blob (store PRIVATE) bila `BLOB_READ_WRITE_TOKEN` terisi — untuk deploy di Vercel (disk serverless sementara);
 *  - folder lokal `storage/bill-proofs` bila tidak (dev / server sendiri).
 * Di kolom `proof_file` disimpan `blob:<pathname>` untuk Blob, atau nama file biasa untuk disk lokal.
 * File selalu disajikan lewat route yang mengecek login & role (tidak pernah lewat URL langsung).
 */
const DIR = path.join(process.cwd(), "storage", "bill-proofs");
const BLOB = "blob:";
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const blobAccess = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";

export const PROOF_MAX_BYTES = 4 * 1024 * 1024; // batas body request serverless Vercel = 4,5 MB
export const PROOF_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };

/** Jenis file sebenarnya dari isi (magic bytes), bukan dari nama/ekstensi yang bisa dipalsukan. */
export function sniff(buf: Buffer): string | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export async function saveProof(billId: string, buf: Buffer, type: string) {
  const file = `${billId}-${randomBytes(6).toString("hex")}.${PROOF_TYPES[type]}`;
  if (useBlob()) {
    const res = await put(`bill-proofs/${file}`, buf, { access: blobAccess(), contentType: type, addRandomSuffix: true });
    return BLOB + res.pathname;
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, file), buf, { mode: 0o600 });
  return file;
}

export async function readProof(ref: string): Promise<Buffer> {
  if (ref.startsWith(BLOB)) {
    const res = await get(ref.slice(BLOB.length), { access: blobAccess() });
    if (!res) throw new Error("proof not found");
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  return readFile(path.join(DIR, path.basename(ref)));
}

export async function removeProof(ref: string | null | undefined) {
  if (!ref) return;
  if (ref.startsWith(BLOB)) return del(ref.slice(BLOB.length)).catch(() => {});
  return unlink(path.join(DIR, path.basename(ref))).catch(() => {});
}
