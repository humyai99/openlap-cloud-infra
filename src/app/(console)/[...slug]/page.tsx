import { Construction } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/common";
import { ALL_NAV_ITEMS } from "@/components/layout/nav";

/** Placeholder for sidebar sections scheduled after Phase 1. */
export default async function ComingSoonPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const href = `/${(await params).slug.join("/")}`;
  const item = ALL_NAV_ITEMS.find((i) => i.href === href);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState icon={Construction} title={`${item.label} is coming soon`} description="This section is part of the next development phase. The data model and API contract are already defined." />
    </>
  );
}
