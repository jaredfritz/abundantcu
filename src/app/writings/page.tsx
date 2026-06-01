import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteShell from "@/components/site/SiteShell";
import { getWritings } from "@/lib/content/writings";

export const metadata: Metadata = {
  title: "Writings",
  description: "Data-informed essays and op-eds on legalizing more homes, lowering living costs, and building a financially resilient Champaign-Urbana.",
  openGraph: {
    title: "Writings | Abundant CU",
    description: "Data-informed essays and op-eds on legalizing more homes, lowering living costs, and building a financially resilient Champaign-Urbana.",
    url: "https://abundantcu.com/writings",
    images: [{ url: "/og/writings.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/writings.png"],
  },
};

export default async function WritingsPage() {
  const writings = await getWritings();
  const featured = writings.find((item) => item.slug === "century-old-building") ?? writings.find((item) => item.featured);
  const featuredTitle =
    featured?.slug === "century-old-building"
      ? "My Turn | A century-old building shouldn't need permission to exist"
      : featured?.title;
  const remaining = writings
    .filter((item) => item.slug !== featured?.slug)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Writings</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Data-informed essays and op-eds on legalizing more homes, lowering living costs, and building a financially resilient Champaign-Urbana.
        </p>

        {featured ? (
          <a
            href={featured.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 block overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5"
          >
            <Image
              src="/writings/century-old-building-layout.jpg"
              alt={`Featured publication: ${featuredTitle ?? featured.title}`}
              width={2400}
              height={3384}
              className="h-auto w-full"
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 64px), 1152px"
              priority
            />
            <div className="border-t border-[var(--color-border)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Featured Publication</p>
              <h2 className="mt-2 text-xl font-bold">{featuredTitle ?? featured.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{featured.summary}</p>
              <p className="mt-3 text-xs text-slate-600">{new Date(featured.publishedAt).toLocaleDateString()}</p>
            </div>
          </a>
        ) : null}

        <div className="mt-8 grid gap-4">
          {remaining.map((item) => {
            const isInternal = item.externalUrl.startsWith("/");
            const CardWrapper = ({ children }: { children: React.ReactNode }) =>
              isInternal ? (
                <Link href={item.externalUrl} className="flex min-h-[170px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5">
                  {children}
                </Link>
              ) : (
                <a href={item.externalUrl} target="_blank" rel="noreferrer" className="flex min-h-[170px] overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white transition hover:-translate-y-0.5">
                  {children}
                </a>
              );
            return (
            <CardWrapper key={item.slug}>
              <div className="relative w-24 shrink-0 self-stretch overflow-hidden border-r border-[var(--color-border)] sm:w-40 md:w-64">
                <Image
                  src={item.thumbnailSrc ?? "/logos/abundantcu-full.png"}
                  alt={`Thumbnail for ${item.title}`}
                  fill
                  sizes="(max-width: 640px) 96px, (max-width: 768px) 160px, 256px"
                  className="object-cover"
                  style={{ objectPosition: item.thumbnailFocus ?? "50% 50%" }}
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-4 md:p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {item.publicationName}
                  </p>
                  <h2 className="mt-1 text-sm font-bold leading-tight sm:text-base md:text-lg">{item.title}</h2>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-700 sm:line-clamp-3 sm:text-sm">{item.summary}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</p>
              </div>
            </CardWrapper>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
