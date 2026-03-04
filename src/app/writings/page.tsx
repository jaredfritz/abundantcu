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
              src="/writings/century-old-building-layout.png"
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

        <div className="mt-8 grid gap-4">
          {remaining.map((item) => (
            <a
              key={item.slug}
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[170px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
            >
              <div className="relative w-56 shrink-0 self-stretch overflow-hidden border-r border-[var(--color-border)] md:w-64">
                <Image
                  src={item.thumbnailSrc ?? "/logos/abundantcu-full.png"}
                  alt={`Thumbnail for ${item.title}`}
                  fill
                  sizes="(max-width: 768px) 224px, 256px"
                  className="object-cover"
                  style={{ objectPosition: item.thumbnailFocus ?? "50% 50%" }}
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-bold leading-tight md:text-lg">{item.title}</h2>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 md:text-xs">
                      {item.publicationName}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-700">{item.summary}</p>
                </div>
                <p className="mt-3 text-xs text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
