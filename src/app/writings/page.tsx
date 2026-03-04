import Image from "next/image";
import SiteShell from "@/components/site/SiteShell";
import { getWritings } from "@/lib/content/writings";

export default async function WritingsPage() {
  const writings = await getWritings();
  const centuryOld = writings.find((item) => item.slug === "century-old-building");

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Writings</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Essays and op-eds about housing, zoning, transit, and fiscal resilience in Champaign-Urbana.
        </p>

        {centuryOld ? (
          <article className="mt-8 overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white">
            <a href={centuryOld.externalUrl} target="_blank" rel="noreferrer" className="block">
              <Image
                src="/writings/century-old-building-layout.png"
                alt="Print layout for 'A more-than-century-old building shouldn’t need permission to exist'"
                width={2086}
                height={3042}
                className="h-auto w-full"
                priority
              />
            </a>
            <div className="border-t border-[var(--color-border)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Featured Print Layout</p>
              <h2 className="mt-2 text-xl font-bold">{centuryOld.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{centuryOld.summary}</p>
            </div>
          </article>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {writings.map((item) => (
            <a
              key={item.slug}
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-[4px] border border-[var(--color-border)] bg-white p-6 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold leading-tight">{item.title}</h2>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {item.publicationName}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-700">{item.summary}</p>
              <p className="mt-3 text-xs text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</p>
            </a>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
