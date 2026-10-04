import type { Metadata } from "next";
import { Suspense } from "react";
import ValuePerAcreDashboard from "@/components/parcels/ValuePerAcreDashboard";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Value Per Acre — Champaign County",
  description:
    "Interactive map of property value and property tax per acre for every parcel in Champaign County, with city filters and a 3D view.",
  openGraph: {
    title: "Value Per Acre — Champaign County | Abundant CU",
    description:
      "Interactive map of property value and property tax per acre for every parcel in Champaign County, with city filters and a 3D view.",
    url: "https://abundantcu.com/data/value-per-acre",
  },
};

export default function ValuePerAcrePage() {
  return (
    <SiteShell>
      <Suspense>
        <ValuePerAcreDashboard />
      </Suspense>
    </SiteShell>
  );
}
