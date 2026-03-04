import SiteShell from "@/components/site/SiteShell";
import { getWritings } from "@/lib/content/writings";

export default async function WritingsPage() {
  const writings = await getWritings();

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Writings</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Essays and op-eds about housing, zoning, transit, and fiscal resilience in Champaign-Urbana.
        </p>
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
