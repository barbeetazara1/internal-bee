import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, getUser } from "@/lib/auth";
import { PROPOSAL_PDF_MAX_BYTES, isPdf, readPdf, removePdf, savePdf } from "@/lib/proposal";

/** Unggah PDF template proposal (hanya Super Admin; PDF, maks. 4 MB). Mengganti file sebelumnya. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || !can.admin(user.role)) return NextResponse.json({ ok: false, message: "You don't have access to this record" }, { status: 403 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("pdf");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, message: "Choose a PDF file first" }, { status: 400 });
  if (file.size > PROPOSAL_PDF_MAX_BYTES) return NextResponse.json({ ok: false, message: "PDF file must be 4 MB or smaller" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (!isPdf(buf)) return NextResponse.json({ ok: false, message: "The file must be a PDF" }, { status: 400 });
  const prev = await prisma.proposalSetting.findUnique({ where: { id: "default" }, select: { pdf_file: true } });
  const stored = await savePdf(buf);
  const name = file.name.replace(/[\\/\r\n]/g, "_").slice(0, 120) || "proposal.pdf";
  try {
    await prisma.proposalSetting.upsert({ where: { id: "default" }, update: { pdf_file: stored, pdf_name: name, pdf_size: buf.length }, create: { id: "default", pdf_file: stored, pdf_name: name, pdf_size: buf.length } });
  } catch (e) {
    await removePdf(stored);
    throw e;
  }
  await removePdf(prev?.pdf_file);
  revalidatePath("/settings/proposal");
  return NextResponse.json({ ok: true, message: "PDF template uploaded", name, size: buf.length });
}

/** Hapus PDF template. */
export async function DELETE() {
  const user = await getUser();
  if (!user || !can.admin(user.role)) return NextResponse.json({ ok: false, message: "You don't have access to this record" }, { status: 403 });
  const cur = await prisma.proposalSetting.findUnique({ where: { id: "default" }, select: { pdf_file: true } });
  if (!cur?.pdf_file) return NextResponse.json({ ok: true, message: "No changes made" });
  await prisma.proposalSetting.update({ where: { id: "default" }, data: { pdf_file: null, pdf_name: null, pdf_size: null } });
  await removePdf(cur.pdf_file);
  revalidatePath("/settings/proposal");
  return NextResponse.json({ ok: true, message: "PDF template removed" });
}

/** Menyajikan PDF template (user yang boleh membuka Leads). Ditampilkan langsung di tab agar bisa dicetak. */
export async function GET() {
  const user = await getUser();
  if (!user || !can.manageLeads(user.role)) return new NextResponse("Forbidden", { status: 403 });
  const s = await prisma.proposalSetting.findUnique({ where: { id: "default" } });
  if (!s?.pdf_file) return new NextResponse("Not found", { status: 404 });
  const data = await readPdf(s.pdf_file).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${(s.pdf_name ?? "proposal.pdf").replace(/"/g, "")}"`, "Cache-Control": "private, no-store" } });
}
