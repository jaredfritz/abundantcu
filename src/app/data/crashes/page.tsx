import type { Metadata } from "next";
import { Suspense } from "react";
import CrashDashboard from "@/components/crashes/CrashDashboard";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Crash Dashboard — Champaign County",
  description: "Interactive map and trends for every reported traffic crash in Champaign County, from IDOT crash data.",
  openGraph: {
    title: "Crash Dashboard — Champaign County | Abundant CU",
    description: "Interactive map and trends for every reported traffic crash in Champaign County, from IDOT crash data.",
    url: "https://abundantcu.com/data/crashes",
  },
};

export default function CrashDashboardPage() {
  return (
    <SiteShell>
      <Suspense>
        <CrashDashboard />
      </Suspense>
    </SiteShell>
  );
}
