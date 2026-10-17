import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/* ---- Penyimpanan file PDF template: Vercel Blob bila BLOB_READ_WRITE_TOKEN ada, selain itu folder lokal storage/proposal ---- */
const DIR = path.join(process.cwd(), "storage", "proposal");
const BLOB = "blob:";
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const access = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";
export const PROPOSAL_PDF_MAX_BYTES = 4 * 1024 * 1024;

export const isPdf = (buf: Buffer) => buf.length > 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-";

export async function savePdf(buf: Buffer) {
  const file = `proposal-${randomBytes(6).toString("hex")}.pdf`;
  if (useBlob()) return BLOB + (await put(`proposal/${file}`, buf, { access: access(), contentType: "application/pdf", addRandomSuffix: true })).pathname;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, file), buf, { mode: 0o600 });
  return file;
}
export async function readPdf(ref: string): Promise<Buffer> {
  if (ref.startsWith(BLOB)) {
    const res = await get(ref.slice(BLOB.length), { access: access() });
    if (!res) throw new Error("pdf not found");
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  return readFile(path.join(DIR, path.basename(ref)));
}
export async function removePdf(ref: string | null | undefined) {
  if (!ref) return;
  if (ref.startsWith(BLOB)) return del(ref.slice(BLOB.length)).catch(() => {});
  return unlink(path.join(DIR, path.basename(ref))).catch(() => {});
}
