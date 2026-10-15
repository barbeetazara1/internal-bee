import { requireRole } from "@/lib/auth";
import { Breadcrumb, Empty, PageHeader } from "@/components/ui";
import ChatterPlaceholder from "@/components/ChatterPlaceholder";
import Section from "@/components/Section";
import ClientForm from "@/components/ClientForm";
import { RecordBar, RecordProvider } from "@/components/Record";

export default async function NewClient() {
  await requireRole("SUPER_ADMIN", "SALES");
  return (
    <RecordProvider isNew listHref="/clients">
      <div>
        <Breadcrumb items={[{ label: "Clients", href: "/clients" }, { label: "Client Baru" }]} />
        <PageHeader title="Client Baru" subtitle="Tambah perusahaan client; setelah itu bisa dipilih pada Lead" />
        <RecordBar />
        <ClientForm />

        {/* Bagian terkait: sama seperti halaman client yang sudah tersimpan, masih kosong */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Section title="Leads" subtitle="0 lead" flush className="self-start"><Empty>Belum ada lead.</Empty></Section>
          <Section title="Projects" subtitle="0 project" flush className="self-start"><Empty>Belum ada project.</Empty></Section>
          <Section title="Licenses" subtitle="0 lisensi" flush className="self-start"><Empty>Belum ada lisensi.</Empty></Section>
        </div>
        <ChatterPlaceholder />
      </div>
    </RecordProvider>
  );
}
