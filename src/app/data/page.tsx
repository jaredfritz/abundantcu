import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ModeMapThumbnail from "@/components/map/ModeMapThumbnail";
import { DataUpdated } from "@/components/site/DataUpdated";
import SiteShell from "@/components/site/SiteShell";
import permitsData from "@/data/residential-permits.json";

export const metadata: Metadata = {
  title: "Data Hub",
  description: "Maps, datasets, and policy tools for Champaign-Urbana land use and urban policy.",
  openGraph: {
    title: "Data Hub | Abundant CU",
    description: "Maps, datasets, and policy tools for Champaign-Urbana land use and urban policy.",
    url: "https://abundantcu.com/data",
    images: [
      {
        url: "/og/data.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/data.png"],
  },
};

export default function DataHubPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Data Hub</h1>
        <p className="mt-3 max-w-3xl text-balance text-sm leading-relaxed text-slate-700 md:text-base">
          Data Hub is where we publish maps, datasets, and policy tools for Champaign-Urbana. These tools are built
          to make local land use and urban policy easier to explore and understand.
        </p>
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600 md:text-base">
          City of Champaign
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            href="/data/zoning"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="h-44 border-b border-[var(--color-border)]">
              <ModeMapThumbnail
                variant="zoning"

                permitsData={permitsData as GeoJSON.FeatureCollection}
                className="h-full w-full"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Zoning Districts</h3>
              <DataUpdated dataset="zoning" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> The city&apos;s
                legal zoning framework, block by block.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> Before we can fix
                affordability, we need to see where current rules allow homes, limit homes, or block them entirely.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Zoning Districts
              </span>
            </div>
          </Link>

          <Link
            href="/data/zoning?mode=permits"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="h-44 border-b border-[var(--color-border)]">
              <ModeMapThumbnail
                variant="permits"

                permitsData={permitsData as GeoJSON.FeatureCollection}
                className="h-full w-full"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Residential Permit Map</h3>
              <DataUpdated dataset="permits" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Where new
                residential permits have actually been issued over the last decade.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> This is the
                real-world production pattern, and it helps us identify where Champaign is adding homes and where we
                are falling behind.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Permit Activity
              </span>
            </div>
          </Link>

          <Link
            href="/data/zoning?mode=build"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="h-44 border-b border-[var(--color-border)]">
              <ModeMapThumbnail
                variant="build"

                permitsData={permitsData as GeoJSON.FeatureCollection}
                className="h-full w-full"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">
                Where Can I Build A <span className="sr-only">type</span>
                <span aria-hidden className="mx-1 inline-block w-14 translate-y-[-2px] border-b-2 border-current" />?
              </h3>
              <DataUpdated dataset="zoning" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Where common
                housing types are allowed by right, allowed conditionally, or not allowed.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> If we want
                abundance, we have to legalize everyday housing options in more neighborhoods, not just in a few
                zones.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Build Types
              </span>
            </div>
          </Link>
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600 md:text-base">
          Community Data
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            href="/data/parking"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="relative h-44 border-b border-[var(--color-border)]">
              <Image
                src="/champaign parking map thumbnail.png"
                alt="Downtown Champaign parking map thumbnail"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Parking Map</h3>
              <p className="mt-1 text-xs text-slate-500">Live, community-mapped</p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Community-mapped
                surface lots and parking garages in downtown Champaign.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> Understanding
                how much land is devoted to parking is essential context for land use reform.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Parking Map
              </span>
            </div>
          </Link>
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600 md:text-base">
          Champaign-Urbana
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            href="/data/crashes"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="relative h-44 border-b border-[var(--color-border)]">
              <Image
                src="/crash-dashboard-thumbnail.png"
                alt="Map of 2025 traffic crashes in Champaign and Urbana, colored by severity"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Crash Dashboard</h3>
              <DataUpdated dataset="crashes" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Every reported
                traffic crash in Champaign, Urbana, and Savoy since 2014, mapped, with a report builder for any city,
                street, or intersection.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> Street design
                decides who gets hurt. Knowing where people are injured and killed is the first step to fixing those
                streets.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Crash Data
              </span>
            </div>
          </Link>

          <Link
            href="/data/value-per-acre"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="relative h-44 border-b border-[var(--color-border)]">
              <Image
                src="/value-per-acre-thumbnail.png"
                alt="3D map of property value per acre in Champaign, with tall spikes downtown and in Campustown"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Value Per Acre</h3>
              <DataUpdated dataset="parcels" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Property value and
                property tax per acre for every parcel in Champaign County, with filters for each city and a 3D view.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> Compact, walkable
                blocks carry far more of the tax base per acre than parking lots, strip development, and vacant land, and
                they cost less to serve.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Value Per Acre
              </span>
            </div>
          </Link>

          <Link
            href="/data/vacant-land"
            className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <div className="relative h-44 border-b border-[var(--color-border)]">
              <Image
                src="/vacant-land-thumbnail.png"
                alt="Map of vacant parcels in Champaign and Urbana, colored by type"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold">Vacant Land</h3>
              <DataUpdated dataset="parcels" className="mt-1" />
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">What this shows:</span> Every vacant
                parcel in Champaign County by type, including subdivision land still assessed at farmland rates.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-[var(--color-primary)]">Why it matters:</span> Empty lots in town
                are where new homes and businesses could go, and they produce almost nothing while the city maintains
                the streets and pipes around them.
              </p>
              <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
                Explore Vacant Land
              </span>
            </div>
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
