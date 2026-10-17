import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ProposalSettingsForm from "@/components/ProposalSettingsForm";
import { PROPOSAL_DEFAULTS } from "@/lib/proposal-template";

export default async function ProposalSettings() {
  await requireRole("SUPER_ADMIN");
  const s = await prisma.proposalSetting.findUnique({ where: { id: "default" } });
  const { validity_days: defDays, ...defaults } = PROPOSAL_DEFAULTS;
  return (
    <div>
      <PageHeader title="Proposal" subtitle="Template proposal yang dicetak dari lead di tahap Proposal" />
      <ProposalSettingsForm
        defaults={{ ...defaults, validity_days: defDays }}
        initial={{
          mode: s?.mode === "PDF" ? "PDF" : "TEXT",
          company_name: s?.company_name ?? "", tagline: s?.tagline ?? "", title: s?.title ?? "", intro: s?.intro ?? "", scope: s?.scope ?? "", terms: s?.terms ?? "", closing: s?.closing ?? "",
          signer_name: s?.signer_name ?? "", signer_title: s?.signer_title ?? "", footer: s?.footer ?? "", validity_days: s?.validity_days ?? defDays,
          pdf_name: s?.pdf_file ? s.pdf_name : null, pdf_size: s?.pdf_file ? s.pdf_size : null,
        }}
      />
    </div>
  );
}
