import { Suspense } from "react";
import MapEmbed from "@/components/map/MapEmbed";
import SiteShell from "@/components/site/SiteShell";
import permitsData from "@/data/residential-permits.json";
import { getZoningGeoJson } from "@/lib/map/getZoningGeoJson";

export default async function DataZoningPage() {
  const zoningData = await getZoningGeoJson();

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Data Hub</p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Champaign Zoning Explorer</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Explore the data behind how our city is built, and how it could be better.
        </p>
      </section>
      <section className="mx-auto w-full max-w-6xl px-5 pb-12 md:px-8 md:pb-16">
        <div className="h-[74vh] min-h-[620px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white">
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
      </section>
    </SiteShell>
  );
}
