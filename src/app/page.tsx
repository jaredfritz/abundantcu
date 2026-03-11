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
    images: [
      {
        url: "/og/home.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/home.png"],
  },
};

export default async function HomePage() {
  const zoningData = await getZoningGeoJson();

  return (
    <SiteShell>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-2 md:items-center md:px-8 md:py-16">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
            Making Champaign-Urbana Affordable and Abundant.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-700 md:text-lg">
            We leverage data and policy to build a resilient city that works for everyone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/data"
              className="cta-primary inline-flex rounded-[4px] px-5 py-3 text-sm font-semibold"
            >
              Explore Data Hub
            </a>
            <a
              href="/action"
              className="inline-flex rounded-[4px] border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-primary)]"
            >
              Take Action
            </a>
          </div>
        </div>
        <div className="h-[320px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white md:h-[420px]">
          <MapEmbed mode="home" interactive={false} data={zoningData} className="h-full w-full" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Legalize More Homes</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Champaign-Urbana cannot become affordable again until we allow more homes in more neighborhoods, at more price points, near jobs, schools, and daily needs.
            </p>
          </article>
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Lower the Cost of Living</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Affordability is more than rent or mortgage alone, so we focus on housing, transportation, and utility costs together to reduce what it actually takes to live well here.
            </p>
          </article>
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-xl font-bold">Make Growth Financially Productive</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              We champion land use and public investment that strengthen the tax base, lower long-run infrastructure liabilities, and make city finances more resilient without raising household burden.
            </p>
          </article>
        </div>
      </section>

    </SiteShell>
  );
}
