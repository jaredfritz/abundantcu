import type { Metadata } from "next";
import Image from "next/image";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Take Action",
  description: "Join partner organizations and take practical steps to support housing abundance in Champaign-Urbana.",
  openGraph: {
    title: "Take Action | Abundant CU",
    description: "Join partner organizations and take practical steps to support housing abundance in Champaign-Urbana.",
    url: "https://abundantcu.com/action",
  },
};

const RESOURCES = [
  {
    label: "Abundant Housing Illinois",
    href: "https://abundanthousingil.org",
    summary: "A statewide coalition working to expand housing supply and reform exclusionary zoning across Illinois. Our closest policy-level ally.",
  },
  {
    label: "YIMBY Action",
    href: "https://yimbyaction.org",
    summary: "A national network pushing to legalize housing and remove barriers to building in high-demand communities. Connects local advocates to a broader movement.",
  },
  {
    label: "Strong Towns",
    href: "https://www.strongtowns.org",
    summary: "A nonprofit movement challenging the postwar suburban development pattern in favor of financially resilient, walkable, incrementally grown cities that are safe, livable, and built to last.",
  },
];

const CURBANISM_SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/groups/curbanismclub", Icon: Facebook },
  { label: "Instagram", href: "https://www.instagram.com/curbanismclub/", Icon: Instagram },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/curbanism-club/", Icon: Linkedin },
];

export default function ActionPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h1 className="text-3xl font-extrabold md:text-4xl">Take Action</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
          Join partner organizations and take practical steps to support abundance in Champaign-Urbana.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Local Partner</p>
                <h2 className="mt-2 text-2xl font-bold">CUrbanism</h2>
              </div>
              <Image src="/curbanism logo.jpeg" alt="CUrbanism" width={140} height={44} className="h-11 w-auto object-contain" />
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Champaign-Urbana&apos;s urbanism club (CUrbanism) advocates for a variety of housing choices, transportation choices, and connected communities where people can live and get around with or without a car. Connect with and advocate alongside a community of neighbors who share this vision.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href="https://curbanism.org/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-[4px] border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
              >
                Visit CUrbanism →
              </a>
              {/* TODO: update href when newsletter link is available */}
              <a
                href="#"
                className="inline-flex rounded-[4px] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Subscribe to Newsletter →
              </a>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {CURBANISM_SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`CUrbanism on ${label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--color-border)] text-slate-600 transition hover:border-slate-400 hover:text-[var(--color-primary)]"
                >
                  <Icon size={15} aria-hidden="true" />
                </a>
              ))}
            </div>
          </article>

          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Elections</p>
                <h2 className="mt-2 text-2xl font-bold">Vote with Abundant CU</h2>
              </div>
              <Image src="/sway-black-logo.png" alt="Sway" width={110} height={44} className="h-11 w-auto object-contain" />
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Get ballot recommendations on candidates and measures that shape affordability and abundance in Champaign-Urbana. When we weigh in, you&apos;ll know who we&apos;re backing and why. Connect with others who share your positions and get a personalized guide for every election.
            </p>
            <a
              href="https://www.sway.co/g/jyvem38k?utm_source=share&ref=rtet6595"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-[4px] border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
            >
              Follow on Sway →
            </a>
          </article>
        </div>

        <section className="mt-8 rounded-[4px] border border-[var(--color-border)] bg-white p-6">
          <h3 className="text-xl font-bold">Resources</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {RESOURCES.map((resource) => (
              <li key={resource.href}>
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-full flex-col rounded-[4px] border border-[var(--color-border)] px-4 py-3 transition hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold group-hover:underline">{resource.label}</span>
                  <span className="mt-1.5 text-xs leading-relaxed text-slate-600">{resource.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </SiteShell>
  );
}
