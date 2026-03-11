import type { Metadata } from "next";
import EditorAdminClient from "@/app/admin/editors/EditorAdminClient";

export const metadata: Metadata = {
  title: "Editor Access Admin",
  robots: { index: false, follow: false },
};

export default async function EditorAccessAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <EditorAdminClient token={params.token ?? ""} />;
}
