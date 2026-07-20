import { FinApp } from "../fin-app";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <FinApp initialSection={section} />;
}
