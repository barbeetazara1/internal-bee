import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Alert, Badge, CreateButton, PageHeader, SummaryCards } from "@/components/ui";
import DataTable, { type Col, type Row } from "@/components/DataTable";
import { ROLE_LABEL } from "@/lib/constants";
import { bulkUserActive, deleteUsers } from "@/app/actions/users";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireRole("SUPER_ADMIN");
  const sp = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { created_at: "asc" } });

  const columns: Col[] = [
    { key: "user", label: "User" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
  ];
  const rows: Row[] = users.map((u) => {
    const self = u.id === me.id;
    return {
      id: u.id,
      href: `/settings/users/${u.id}`,
      selectable: !self,
      cells: {
        user: { text: `${u.name} ${u.email}`, node: <div><div className="font-medium">{u.name}{self && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}</div><div className="text-xs text-slate-500">{u.email}</div></div> },
        role: { text: ROLE_LABEL[u.role], node: <Badge tone={u.role === "SUPER_ADMIN" ? "amber" : "slate"}>{ROLE_LABEL[u.role]}</Badge> },
        status: { text: u.is_active ? "Aktif" : "Nonaktif", node: u.is_active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge> },
      },
    };
  });

  const byRole = (r: string) => users.filter((u) => u.role === r).length;
  return (
    <div>
      <PageHeader title="Manajemen User" subtitle="Kelola akun & hak akses (RBAC)">
        <CreateButton href="/settings/users/new">User Baru</CreateButton>
      </PageHeader>
      <SummaryCards
        items={[
          { label: "Total User", value: users.length, hint: `${users.filter((u) => !u.is_active).length} nonaktif` },
          { label: "User Aktif", value: users.filter((u) => u.is_active).length, hint: users.length ? `${Math.round((users.filter((u) => u.is_active).length / users.length) * 100)}% dari semua user` : undefined },
          { label: "Per Role", value: `${byRole("SUPER_ADMIN")} · ${byRole("SALES")} · ${byRole("PROJECT")}`, hint: "Admin · Sales · Project" },
        ]}
      />
      {sp.error && <Alert>{sp.error}</Alert>}
      <DataTable
        columns={columns}
        rows={rows}
        exportName="users"
        searchPlaceholder="Cari nama, email, role…"
        actions={[
          { label: "Aktifkan", run: bulkUserActive.bind(null, true) },
          { label: "Nonaktifkan", run: bulkUserActive.bind(null, false), confirm: "Nonaktifkan {n} user terpilih?" },
          { label: "Delete", run: deleteUsers, danger: true, confirm: "Delete {n} selected user(s)? This can't be undone." },
        ]}
      />
    </div>
  );
}
