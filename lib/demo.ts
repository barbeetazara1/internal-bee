/** Status demo yang efektif: demo "Berjalan" yang sudah melewati batas waktunya dianggap "Selesai". */
export function effectiveDemoStatus(d: { status: string; ends_at: Date | null }) {
  if (d.status === "ACTIVE" && d.ends_at && d.ends_at.getTime() < Date.now()) return "ENDED";
  return d.status;
}
