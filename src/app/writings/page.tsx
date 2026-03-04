import Image from "next/image";
import SiteShell from "@/components/site/SiteShell";
import { getWritings } from "@/lib/content/writings";

export default async function WritingsPage() {
  const writings = await getWritings();
  const featured = writings.find((item) => item.slug === "century-old-building") ?? writings.find((item) => item.featured);
  const remaining = writings
    .filter((item) => item.slug !== featured?.slug)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Writings</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Essays and op-eds about housing, zoning, transit, and fiscal resilience in Champaign-Urbana.
        </p>

        {featured ? (
          <a
            href={featured.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 block overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <Image
              src={featured.thumbnailSrc ?? "/writings/century-old-building-layout.png"}
              alt={`Featured publication: ${featured.title}`}
              width={2086}
              height={3042}
              className="h-auto w-full"
              priority
            />
            <div className="border-t border-[var(--color-border)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Featured Publication</p>
              <h2 className="mt-2 text-xl font-bold">{featured.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{featured.summary}</p>
              <p className="mt-3 text-xs text-slate-500">{new Date(featured.publishedAt).toLocaleDateString()}</p>
            </div>
          </a>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {remaining.map((item) => (
            <a
              key={item.slug}
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
            >
              <Image
                src={item.thumbnailSrc ?? "/logos/abundantcu-full.png"}
                alt={`Thumbnail for ${item.title}`}
                width={1200}
                height={630}
                className="h-auto w-full border-b border-[var(--color-border)]"
              />
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold leading-tight">{item.title}</h2>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {item.publicationName}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-700">{item.summary}</p>
                <p className="mt-3 text-xs text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
