import type { Metadata } from "next";
import { Suspense } from "react";
import SiteShell from "@/components/site/SiteShell";
import ParkingMapperClient from "./ParkingMapperClient";

export const metadata: Metadata = {
  title: "Parking Map — Downtown Champaign",
  description: "Community-mapped parking lots and garages in downtown Champaign.",
  robots: { index: true, follow: true },
};

export default function ParkingMapPage() {
  return (
    <SiteShell>
      <Suspense>
        <ParkingMapperClient />
      </Suspense>
    </SiteShell>
  );
}
