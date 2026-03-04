import SiteShell from "@/components/site/SiteShell";

const RESOURCES = [
  { label: "Strong Towns", href: "https://www.strongtowns.org" },
  { label: "YIMBY Action", href: "https://yimbyaction.org" },
  { label: "Abundant Housing Illinois", href: "https://abundanthousingil.org" },
];

const CURBANISM_SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/groups/curbanismclub" },
  { label: "Instagram", href: "https://www.instagram.com/curbanismclub/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/curbanism-club/" },
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
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Local Partner</p>
            <h2 className="mt-2 text-2xl font-bold">CUrbanism</h2>
            <p className="mt-3 text-sm text-slate-700">
              Join for walking tours, socials, and local community-building around better urbanism.
            </p>
            <a
              href="https://curbanism.org/"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-[4px] border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold"
            >
              Join CUrbanism
            </a>
            <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {CURBANISM_SOCIALS.map((social) => (
                <li key={social.href}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-[4px] border border-[var(--color-border)] px-3 py-2 hover:bg-slate-50"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[4px] border border-[var(--color-border)] bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Governance</p>
            <h2 className="mt-2 text-2xl font-bold">Delegate on Sway</h2>
            <p className="mt-3 text-sm text-slate-700">
              Delegate your vote to Abundant CU on Sway and help build durable policy momentum.
            </p>
            <a
              href="https://www.sway.co/g/jyvem38k?utm_source=share&ref=rtet6595"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-[4px] border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold"
            >
              Delegate on Sway
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
                  className="block rounded-[4px] border border-[var(--color-border)] px-4 py-3 text-sm font-medium hover:bg-slate-50"
                >
                  {resource.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </SiteShell>
  );
}
