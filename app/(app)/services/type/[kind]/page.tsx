import { notFound } from "next/navigation";
import ServiceList from "@/components/ServiceList";

const KINDS: Record<string, string> = { hosting: "HOSTING", domain: "DOMAIN", ssl: "SSL", maintenance: "MAINTENANCE", other: "OTHER" };

export default async function ServicesByKind({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ project?: string }> }) {
  const { kind } = await params;
  const { project } = await searchParams;
  const k = KINDS[kind];
  if (!k) notFound();
  return <ServiceList kind={k} projectId={project} />;
}
