import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getReadingDetail } from "@/app/actions";
import { ReadingDetailView } from "@/components/library/reading-detail-view";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getReadingDetail(id);
  if (!detail) notFound();
  return <ReadingDetailView {...detail} />;
}
