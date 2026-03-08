import type { Metadata } from "next";
import MapEmbed from "@/components/map/MapEmbed";
import SiteShell from "@/components/site/SiteShell";
import { getZoningGeoJson } from "@/lib/map/getZoningGeoJson";

export const metadata: Metadata = {
  title: "Abundant CU",
  description: "Making Champaign-Urbana Affordable and Abundant. We leverage data and policy to build a resilient city that works for everyone.",
  openGraph: {
    title: "Abundant CU",
    description: "Making Champaign-Urbana Affordable and Abundant.",
    url: "https://abundantcu.com",
  },
};

export default async function HomePage() {
  const zoningData = await getZoningGeoJson();

  return (
    <SiteShell>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-2 md:items-center md:px-8 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Abundant CU</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
            Making Champaign-Urbana Affordable and Abundant.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-700 md:text-lg">
            We leverage data and policy to build a resilient city that works for everyone.
          </p>
          <a
            href="/action"
            className="mt-8 inline-flex rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-primary)]"
          >
            Take Action →
          </a>
        </div>
        <div className="h-[320px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white md:h-[420px]">
          <MapEmbed mode="home" interactive={false} data={zoningData} className="h-full w-full" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Legalize Housing</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              End restrictive zoning and legalize missing middle housing so more people can live in more neighborhoods.
            </p>
          </article>
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Fiscal Strength</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Support productive land use that improves tax productivity and sustains core infrastructure over time.
            </p>
          </article>
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Connected Transit</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Build a city with safer streets, reliable transit, and human-scale design that makes daily movement easier.
            </p>
          </article>
        </div>
      </section>

    </SiteShell>
  );
}
