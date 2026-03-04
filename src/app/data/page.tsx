import Link from "next/link";
import SiteShell from "@/components/site/SiteShell";

export default function DataHubPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Data Hub</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Data Hub is where we publish maps, datasets, and policy tools for Champaign-Urbana. These tools are built
          to make local land use and urban policy easier to explore and understand.
        </p>

        <div className="mt-8 grid gap-4">
          <Link
            href="/data/zoning"
            className="rounded-[4px] border border-[var(--color-border)] bg-white p-6 transition hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tool 01</p>
              <span className="rounded-[4px] border border-[var(--color-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Live
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-bold">Champaign Zoning Explorer</h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
              Explore zoning districts, residential permit activity, and build-type overlays to understand how
              regulations shape housing outcomes across Champaign.
            </p>
            <span className="mt-5 inline-flex rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
              Open Map
            </span>
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
