import type { Metadata } from "next";
import { Suspense } from "react";
import VacantLandDashboard from "@/components/parcels/VacantLandDashboard";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Vacant Land — Champaign County",
  description:
    "Map of every vacant parcel in Champaign County by type, including subdivision land assessed at farmland rates, with city filters and the largest vacant parcels.",
  openGraph: {
    title: "Vacant Land — Champaign County | Abundant CU",
    description:
      "Map of every vacant parcel in Champaign County by type, including subdivision land assessed at farmland rates, with city filters and the largest vacant parcels.",
    url: "https://abundantcu.com/data/vacant-land",
  },
};

export default function VacantLandPage() {
  return (
    <SiteShell>
      <Suspense>
        <VacantLandDashboard />
      </Suspense>
    </SiteShell>
  );
}
