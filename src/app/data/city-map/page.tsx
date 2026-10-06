import type { Metadata } from "next";
import { Suspense } from "react";
import CityMapExplorer from "@/components/city-map/CityMapExplorer";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Champaign City Map",
  description:
    "Every City of Champaign zoning layer and district boundary on one map, with parcel values for every lot. Click anywhere to see its zoning, council district, TIF district, and more.",
  openGraph: {
    title: "Champaign City Map | Abundant CU",
    description:
      "Every City of Champaign zoning layer and district boundary on one map, with parcel values for every lot. Click anywhere to see its zoning, council district, TIF district, and more.",
    url: "https://abundantcu.com/data/city-map",
  },
};

export default function CityMapPage() {
  return (
    <SiteShell>
      <Suspense>
        <CityMapExplorer />
      </Suspense>
    </SiteShell>
  );
}
