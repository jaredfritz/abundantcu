import EmailSignupForm from "@/components/forms/EmailSignupForm";
import MapEmbed from "@/components/map/MapEmbed";
import SiteShell from "@/components/site/SiteShell";
import { getZoningGeoJson } from "@/lib/map/getZoningGeoJson";

export default async function HomePage() {
  const zoningData = await getZoningGeoJson();

  return (
    <SiteShell>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-2 md:items-center md:px-8 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Abundant CU</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
            Making Champaign-Urbana Affordable and Abundant.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-700 md:text-lg">
            We leverage data and policy to build a resilient city that works for everyone.
          </p>
          <a
            href="#email-signup"
            className="mt-8 inline-flex rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-primary)]"
          >
            Join the Email Signal
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

      <section id="email-signup" className="mx-auto w-full max-w-6xl px-5 pb-14 pt-4 md:px-8 md:pb-20">
        <div className="rounded-[4px] border border-[var(--color-border)] bg-white p-6 md:p-8">
          <h3 className="text-2xl font-bold">Stay Updated</h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-700">
            Stay updated and informed. We&apos;ll share relevant policy updates and data insights from time to time.
          </p>
          <div className="mt-5">
            <EmailSignupForm sourcePage="home" />
          </div>
        </div>
      </section>

      <a
        href="#email-signup"
        className="fixed bottom-5 right-5 z-40 rounded-[4px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-sm md:bottom-6 md:right-6"
      >
        Sign Up for Updates
      </a>
    </SiteShell>
  );
}
