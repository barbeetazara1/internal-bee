import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Breadcrumb, PageHeader } from "@/components/ui";
import ChatterSection from "@/components/ChatterSection";
import ChangePasswordMenu from "@/components/ChangePasswordMenu";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { ROLE_OPTIONS } from "@/lib/constants";
import { saveUser } from "@/app/actions/users";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) notFound();
  const self = u.id === me.id;
  return (
    <RecordProvider listHref="/settings/users">
      <div>
        <Breadcrumb items={[{ label: "Users", href: "/settings/users" }, { label: u.name }]} />
        <PageHeader title={u.name} subtitle={self ? "Ini akun Anda — role dan status tidak dapat diubah dari sini" : undefined} />
        <RecordBar createHref="/settings/users/new" center={<ChangePasswordMenu userId={u.id} userName={u.name} />} />
        <RecordForm action={saveUser} className="fields-compact space-y-6">
          <input type="hidden" name="id" value={u.id} />
          <Section title="Informasi Akun" subtitle="Nama dan email login (password diganti lewat More Actions)">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <div><label className="label">Nama<span className="text-red-500"> *</span></label><input name="name" required defaultValue={u.name} className="input" /></div>
              <div><label className="label">Email<span className="text-red-500"> *</span></label><input name="email" type="email" required defaultValue={u.email} className="input" /></div>
            </div>
          </Section>
          <Section title="Hak Akses" subtitle="Role dan status akun">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
              <div><label className="label">Role</label><Select name="role" options={ROLE_OPTIONS} defaultValue={u.role} locked={self} /></div>
              <div><label className="label">Status</label><Select name="is_active" options={[{ value: "true", label: "Aktif" }, { value: "false", label: "Nonaktif" }]} defaultValue={u.is_active ? "true" : "false"} locked={self} /></div>
            </div>
          </Section>
        </RecordForm>
        <ChatterSection type="user" id={u.id} label={u.name} />
      </div>
    </RecordProvider>
  );
}
