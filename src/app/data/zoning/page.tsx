import type { Metadata } from "next";
import { Suspense } from "react";
import MapEmbed from "@/components/map/MapEmbed";
import SiteShell from "@/components/site/SiteShell";
import permitsData from "@/data/residential-permits.json";
import { getZoningGeoJson } from "@/lib/map/getZoningGeoJson";

export const metadata: Metadata = {
  title: "Champaign Zoning Explorer",
  description: "Explore zoning districts, residential permit activity, and build-type overlays across Champaign, IL.",
  openGraph: {
    title: "Champaign Zoning Explorer | Abundant CU",
    description: "Explore zoning districts, residential permit activity, and build-type overlays across Champaign, IL.",
    url: "https://abundantcu.com/data/zoning",
  },
};

export default async function DataZoningPage() {
  const zoningData = await getZoningGeoJson();

  return (
    <SiteShell>
      <div className="h-[calc(100dvh-69px)] overflow-hidden">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-100" />}>
          <MapEmbed
            mode="full"
            interactive
            data={zoningData}
            permitsData={permitsData as GeoJSON.FeatureCollection}
            className="h-full w-full"
          />
        </Suspense>
      </div>
    </SiteShell>
  );
}
