import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { PageHeader, StatusBadge, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import KeyReveal from "@/components/KeyReveal";
import { fmtDate } from "@/lib/format";
import { effectiveStatus } from "@/lib/keys";
import { deleteLicenses } from "@/app/actions/keys";

/** Daftar license (dikelompokkan per client). kind: PRODUCTION = hasil Closed Won, DEMO = hasil permintaan demo. */
export default async function LicenseList({ kind }: { kind: "PRODUCTION" | "DEMO" }) {
  const user = await requireUser();
  const demo = kind === "DEMO";
  const keys = await prisma.apiKey.findMany({ relationLoadStrategy: "join", where: { kind }, orderBy: [{ client: { name: "asc" } }, { created_at: "asc" }], include: { client: true, product: true, demo: true } });

  const columns: Col[] = [
    { key: "client", label: "Client", hidden: true }, // dipakai sebagai group-by
    { key: "product", label: "Produk" },
    ...(demo ? [{ key: "demo", label: "Demo" }] : []),
    { key: "key", label: "Key" },
    { key: "env", label: "Env" },
    { key: "status", label: "Status" },
    { key: "expires", label: demo ? "Demo Berakhir" : "Berlaku s/d" },
  ];
  const rows: Row[] = keys.map((k) => {
    const st = effectiveStatus(k);
    const mask = `${k.prefix}••••••••${k.key_hint}`;
    return {
      id: k.id,
      href: `/licenses/${k.id}`,
      group: k.client.name,
      cells: {
        client: { text: k.client.name, node: <div className="font-medium">{k.client.name}</div> },
        product: { text: `${k.product.name} ${k.product.code}`, node: <div>{k.product.name}<div className="font-mono text-xs text-slate-500">{k.product.code}</div></div> },
        demo: { text: k.demo?.code ?? "—", node: <span className="font-mono text-xs">{k.demo?.code ?? "—"}</span> },
        key: { text: mask, node: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{mask}</code> },
        env: { text: k.environment, node: <StatusBadge status={k.environment} /> },
        status: { text: st, node: <StatusBadge status={st} /> },
        expires: { text: fmtDate(k.expires_at) },
      },
    };
  });

  const now = Date.now();
  const horizon = (demo ? 7 : 30) * 86400000;
  const activeKeys = keys.filter((k) => effectiveStatus(k) === "ACTIVE");
  const expiring = activeKeys.filter((k) => k.expires_at && k.expires_at.getTime() - now <= horizon);
  return (
    <div>
      <PageHeader
        title={demo ? "Licenses — Demo" : "Licenses — Production"}
        subtitle={demo ? "License key sandbox untuk demo — dibuat otomatis saat demo dimulai" : "API key & lisensi client — dibuat otomatis saat lead Closed Won"}
      />
      <SummaryCards
        items={[
          { label: demo ? "Total License Demo" : "Total Lisensi", value: keys.length, hint: `${new Set(keys.map((k) => k.client_id)).size} client` },
          { label: demo ? "Demo Aktif" : "Lisensi Aktif", value: activeKeys.length, hint: `${keys.filter((k) => k.status === "SUSPENDED").length} ditangguhkan · ${keys.filter((k) => k.status === "REVOKED").length} dicabut` },
          { label: "Segera Berakhir", value: expiring.length, hint: `dalam ${demo ? 7 : 30} hari ke depan` },
        ]}
      />
      <KeyReveal />
      <DataTable
        columns={columns}
        rows={rows}
        exportName={demo ? "licenses-demo" : "licenses"}
        groupLabel="Client"
        searchPlaceholder="Cari client, produk, status…"
        emptyText={demo ? "Belum ada license demo. Mulai sebuah demo dari menu Demo." : "Belum ada lisensi. Tutup sebuah lead sebagai Closed Won."}
        actions={can.revokeKey(user.role) ? [{ label: "Delete", run: deleteLicenses, danger: true, confirm: "Delete {n} selected license(s) and their usage history? The keys stop working immediately. This can't be undone." }] : []}
      />
    </div>
  );
}
