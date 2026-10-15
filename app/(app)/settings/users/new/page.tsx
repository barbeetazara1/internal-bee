import { RecordBar, RecordForm, RecordProvider } from "@/components/Record";
import { requireRole } from "@/lib/auth";
import { Alert, PageHeader , Breadcrumb } from "@/components/ui";
import Section from "@/components/Section";
import Select from "@/components/Select";
import { ROLE_OPTIONS } from "@/lib/constants";
import { createUser } from "@/app/actions/users";

export default async function NewUser({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("SUPER_ADMIN");
  const sp = await searchParams;
  return (
    <RecordProvider isNew listHref="/settings/users">
    <div>
      <Breadcrumb items={[{ label: "Users", href: "/settings/users" }, { label: "User Baru" }]} />
      <PageHeader title="User Baru" subtitle="Buat akun dan tentukan hak aksesnya" />
      <RecordBar />
      {sp.error && <Alert>{sp.error}</Alert>}
      <RecordForm action={createUser} className="fields-compact space-y-6">
        <Section title="Informasi Akun" subtitle="Identitas dan kredensial login">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
            <div><label className="label">Nama<span className="text-red-500"> *</span></label><input name="name" required className="input" /></div>
            <div><label className="label">Email<span className="text-red-500"> *</span></label><input name="email" type="email" required className="input" /></div>
            <div><label className="label">Password<span className="text-red-500"> *</span> (min. 8 karakter)</label><input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
          </div>
        </Section>
        <Section title="Hak Akses" subtitle="Role menentukan menu dan aksi yang tersedia">
          <div className="max-w-sm"><label className="label">Role</label><Select name="role" options={ROLE_OPTIONS} defaultValue="SALES" /></div>
        </Section>
      </RecordForm>
    </div>
    </RecordProvider>
  );
}
