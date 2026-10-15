import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, getUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { BILL_LABEL } from "@/lib/constants";
import { PROOF_MAX_BYTES, readProof, removeProof, saveProof, sniff } from "@/lib/proof";

type Ctx = { params: Promise<{ id: string }> };

/** Tandai bill lunas dengan bukti pembayaran (PNG / JPG / PDF, maks. 4 MB). Bukti wajib. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user || !can.manageBills(user.role)) return NextResponse.json({ ok: false, message: "You don't have access to this record" }, { status: 403 });
  const { id } = await params;
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) return NextResponse.json({ ok: false, message: "Bill not found" }, { status: 404 });
  if (bill.status !== "UNPAID") return NextResponse.json({ ok: false, message: "Only unpaid bills can be marked as paid" }, { status: 400 });

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("proof");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, message: "Payment proof is required" }, { status: 400 });
  if (file.size > PROOF_MAX_BYTES) return NextResponse.json({ ok: false, message: "Proof file must be 4 MB or smaller" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return NextResponse.json({ ok: false, message: "Proof must be a PNG, JPG or PDF file" }, { status: 400 });

  const stored = await saveProof(id, buf, type);
  const name = file.name.replace(/[\\/\r\n]/g, "_").slice(0, 120) || `proof.${type.split("/")[1]}`;
  try {
    await prisma.bill.update({ where: { id }, data: { status: "PAID", paid_at: new Date(), proof_file: stored, proof_name: name, proof_type: type, proof_size: buf.length } });
  } catch (e) {
    await removeProof(stored); // jangan tinggalkan file yatim bila penyimpanan gagal
    throw e;
  }
  await logActivity(prisma, { type: "bill", id, kind: "EVENT", authorId: user.id, label: bill.code, body: `Status changed: ${BILL_LABEL.UNPAID} → ${BILL_LABEL.PAID} (proof: ${name})` });
  revalidatePath(`/bills/${id}`);
  revalidatePath("/bills");
  return NextResponse.json({ ok: true, message: "Bill marked as paid" });
}

/** Menyajikan file bukti (hanya user yang boleh membuka Bills). ?download=1 memaksa unduh. */
export async function GET(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user || !can.manageBills(user.role)) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const bill = await prisma.bill.findUnique({ where: { id }, select: { proof_file: true, proof_name: true, proof_type: true } });
  if (!bill?.proof_file) return new NextResponse("Not found", { status: 404 });
  const data = await readProof(bill.proof_file).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });
  const dl = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": bill.proof_type ?? "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(bill.proof_name ?? "proof")}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

