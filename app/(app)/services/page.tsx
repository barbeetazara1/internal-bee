import ServiceList from "@/components/ServiceList";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  return <ServiceList projectId={project} />;
}
