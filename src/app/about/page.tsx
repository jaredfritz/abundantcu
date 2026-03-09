import type { Metadata } from "next";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "About",
  description: "About Abundant CU: what this site is and how to submit suggestions or corrections.",
  openGraph: {
    title: "About | Abundant CU",
    description: "About Abundant CU: what this site is and how to submit suggestions or corrections.",
    url: "https://abundantcu.com/about",
  },
};

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">About</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
          Abundant CU is a local policy and data publication focused on abundance and affordability in
          Champaign-Urbana. We publish maps, analysis, and writings about housing supply, land use, and the economics
          of city growth.
          <span className="block mt-3">Abundant CU is published by Jared Fritz.</span>
        </p>

        <section className="mt-8 border-t border-[var(--color-border)] pt-6">
          <h2 className="text-xl font-bold">Contact, Suggestions, and Corrections</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">
            Reach us at{" "}
            <a className="text-blue-600 hover:underline" href="mailto:abundantcu@gmail.com">
              abundantcu@gmail.com
            </a>
            .
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 md:text-base">
            Suggestions for data dives, visualizations, maps, or policy topics are welcome.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 md:text-base">
            If you spot an error, send a correction with supporting source information and we will review and correct
            promptly when warranted.
          </p>
        </section>

        <section className="mt-8 border-t border-[var(--color-border)] pt-6">
          <h2 className="text-xl font-bold">Disclosure</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">
            Abundant CU is a project of Goodscale LLC. Content on this site is provided for informational and
            public-discussion purposes and may contain errors or omissions.
          </p>
        </section>
      </section>
    </SiteShell>
  );
}
