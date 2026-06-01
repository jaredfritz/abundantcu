import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Housing Can't Wait",
  description:
    "A point-by-point response to the arguments being made against the 32-unit apartment building proposed for 413–419 W. Main Street, ahead of tonight's council vote.",
  openGraph: {
    title: "Housing Can't Wait | Abundant CU",
    description:
      "A point-by-point response to the arguments being made against the 32-unit apartment building proposed for 413–419 W. Main Street, ahead of tonight's council vote.",
    url: "https://abundantcu.com/writings/urbana-open-letter",
    images: [{ url: "/og/open-letter.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/open-letter.png"],
  },
};

const claims: { claim: string; response: React.ReactNode[] }[] = [
  {
    claim: "New market-rate apartments don't help affordability.",
    response: [
      <>
        They do. New units set off a chain of moves: each person who upgrades into a new apartment
        vacates a slightly older, cheaper one. The research on this is consistent: new market-rate
        apartments reduce rents and free up older, cheaper units for lower-income households
        {" "}(<a href="https://lewis.ucla.edu/research/market-rate-development-impacts/" target="_blank" rel="noreferrer" className="text-[var(--color-accent-secondary)] underline underline-offset-2 hover:opacity-80">UCLA Lewis Center</a>,{" "}
        <a href="https://www.americanprogress.org/article/build-baby-build-a-plan-to-lower-housing-costs-for-all/" target="_blank" rel="noreferrer" className="text-[var(--color-accent-secondary)] underline underline-offset-2 hover:opacity-80">American Progress</a>).
        {" "}Minneapolis built more housing than any comparable Midwestern city and saw rents fall.
        Cities that restricted supply saw rents rise. This is the mainstream conclusion of housing
        economics research. It is not contested.
      </>,
    ],
  },
  {
    claim: "Building this will displace the current tenants.",
    response: [
      "This is a real concern, and it deserves a real answer. Existing leases must be honored by law. Proper notice of nonrenewal is required. Any framing that current tenants will be \"on the street tomorrow\" is inaccurate.",
      "But more importantly: this argument applies equally to any redevelopment of these parcels, including four single-family homes, which are legal to build by right and require no council approval, no public hearings, no special exception. If \"no displacement ever\" is the standard, nothing can ever be built here. If that's not the standard, then this argument isn't really about tenant protection. It's about blocking the project.",
      "Do we need stronger tenant protections and moving assistance requirements? Yes. Pass them. But that's a separate vote.",
    ],
  },
  {
    claim: "Lots of the big apartment buildings are sitting half empty.",
    response: [
      "This is directly contradicted by local data. Champaign's active rental vacancy rate is under 2%, well below the roughly 7% considered healthy. A recent Urbana landlord survey found 80% of landlords have zero vacancies, and 91% have zero or one vacancy. The claim that apartments are sitting half empty is not supported by any evidence and contradicts every local housing study conducted in recent years.",
    ],
  },
  {
    claim: "This will cause traffic problems, parking issues, and delivery vehicle congestion.",
    response: [
      "This building adds roughly 30 units of demand to a corridor that already handles hundreds of units of residential traffic. The marginal impact is small. More importantly, blocking housing is not a proportionate response to traffic enforcement concerns; those can be addressed through enforcing the rules of the road and city ordinances already on the books.",
      "It's also worth noting that pushing development to the suburban edge, which is what happens when infill projects like this are blocked, generates far more vehicle miles traveled than compact, walkable, near-downtown housing like this project.",
    ],
  },
  {
    claim: "It's an outstanding project, an outstanding idea. It should just go somewhere else, like 211 N. Race Street.",
    response: [
      "That also sounds like a good location for housing. Why not both? Our community needs far more than one development.",
      "But the 211 N. Race Street site has been publicly owned for over three years. The city has spent $1.1 million acquiring and clearing it. Has the city issued an RFP? Have they engaged developers on what could be built there? If that site were a genuine priority, there would be evidence of urgency. There isn't.",
      "More fundamentally: a developer cannot simply relocate their plan to a different site. DMCB Properties owns these specific parcels. Telling them to build somewhere else isn't a compromise. It's a rejection.",
      "There is always a better location. It never materializes.",
    ],
  },
  {
    claim: "The building is out of character with the area: wrong colors, wrong design, too big.",
    response: [
      "This is the most subjective argument on this list, and it deserves the most direct challenge.",
      "If you want to prioritize neighborhood character, you need to be honest about what you're trading away to do it. We have a sub-2% vacancy rate. We have 4,000 families on the county housing waiting list. We have lost roughly 550 affordable units in recent years to condemnations. We are not in a situation where aesthetic preferences are a costless priority. Every time we say \"just not here,\" someone who needs housing doesn't get it.",
      "This argument was made on this block in 1991. The council sided with it. Here is what that produced: two vacant parcels, a 21-year gap, and a housing shortage severe enough that we are still having the same conversation.",
    ],
  },
  {
    claim: "The project is fine, it just needs to be smaller.",
    response: [
      "This sounds like a reasonable compromise. It isn't.",
      "The flood constraints on this site mean the project has to reach a minimum density just to be financially viable. That is why at least three previous developers tried to build here and couldn't make the numbers work. The 32-unit figure is not a starting offer. It is the floor.",
      "\"Make it smaller\" is a polite way of saying \"don't build it.\" And even if the math did work at a smaller scale: every unit cut is a family not housed.",
      "Opponents have not identified a size they would support. And even if they had, redesigning the project at this stage would almost certainly kill it, which may be the point.",
    ],
  },
  {
    claim: "This won't be affordable for low-income residents. SSI recipients can't afford it.",
    response: [
      "This concern is real, and it calls for real solutions: more housing vouchers, more subsidized units, stronger enforcement of the source-of-income protections Urbana already has on the books but has struggled to enforce.",
      "But the vote before the council is not a vote on any of those programs. Rejecting this project does not produce a single subsidized apartment. It maintains the status quo of two vacant lots. Market-rate supply and subsidized housing are complementary priorities, not competing ones. Restrictive zoning makes subsidized housing harder to build too. When land costs more and every project requires years of process, public dollars for affordable units go less far.",
      "Saying no to this project doesn't create more subsidized housing. It just blocks 32 new homes.",
    ],
  },
  {
    claim: "We need owner-occupied housing, not more rentals.",
    response: [
      "Urbana is a university city. Rental demand is structural: it is a function of who lives here and why, not a symptom of bad policy. The answer to \"we need more ownership opportunities\" is to build more housing of all types, which a healthier, less constrained market makes possible over time. Blocking rental supply does not produce ownership opportunities. It produces vacancy rates under 2% and competition for the units that do exist.",
    ],
  },
  {
    claim: "Four stories is too tall for this neighborhood.",
    response: [
      "The height is not a preference: it is a function of the site. Flood constraints require increased density to make the project financially viable. A shorter building is not a compromise. It is a rejection with better manners. See also: three previous developers who tried to build here at lower densities and couldn't make it work.",
    ],
  },
  {
    claim: "The process was rushed and the community wasn't adequately consulted.",
    response: [
      "This project went through the Plan Commission, which recommended approval 4–1. It went through multiple public meetings. It went through a full Committee of the Whole hearing that generated hours of testimony. The process worked exactly as designed.",
      "Repeating the process indefinitely until opponents are satisfied is not a process. It is a veto. At some point the city has to decide.",
    ],
  },
];

export default function UrbanOpenLetterPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14">

        {/* Header */}
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Open Letter &nbsp;·&nbsp; June 1, 2026
        </p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">
          Housing Can't Wait
        </h1>
        <p className="mt-3 text-base font-semibold text-slate-600">
          An Open Letter to the Urbana City Council
        </p>
        <p className="mt-1 text-sm text-slate-500">
          By <span className="font-semibold text-[var(--color-primary)]">Jared Fritz</span>
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/writings/urbana-open-letter.pdf"
            download
            className="cta-primary inline-flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </a>
          <a
            href="https://www.smilepolitely.com/opinion/an-outstanding-project-an-outstanding-idea-just-not-here/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-[4px] border border-[var(--color-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-slate-50"
          >
            Related op-ed in Smile Politely ↗
          </a>
        </div>

        {/* Intro */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6 space-y-3 text-sm leading-relaxed text-slate-700 md:text-base">
          <p>
            Tonight, the Urbana City Council will vote on a new apartment building on the 400 block of W. Main Street.
            I wrote about the history and stakes of this decision in{" "}
            <a
              href="https://www.smilepolitely.com/opinion/an-outstanding-project-an-outstanding-idea-just-not-here/"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent-secondary)] underline underline-offset-2 hover:opacity-80"
            >
              Smile Politely
            </a>
            . The short version: Urbana has been here before, made the wrong call, and is still living with the consequences. We have a chance to make a different one.
          </p>
          <p>
            Opponents will make arguments against this project. Some of these arguments may sound reasonable. None of them hold up.
          </p>
          <p className="font-semibold text-[var(--color-primary)]">
            Here is what you will likely hear, and why it doesn't change the math.
          </p>
        </div>

        {/* Claims */}
        <div className="mt-8 space-y-0">
          {claims.map(({ claim, response }, i) => (
            <section key={i} className="border-t border-[var(--color-border)] py-6">
              <div className="flex min-h-[48px] items-center rounded-[4px] border border-[var(--color-border)] bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold italic text-slate-600">"{claim}"</span>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 md:text-base">
                {response.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Conclusion */}
        <section className="mt-2 border-t border-[var(--color-border)] pt-6">
          <h2 className="text-xl font-bold">What this vote actually is</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 md:text-base">
            <p>
              Every argument above has a surface logic to it. Taken individually, each one sounds like a reasonable concern raised by a reasonable neighbor.
            </p>
            <p>
              But look at what they add up to. The building is too tall. Too dense. The wrong style. The wrong location. The wrong type of housing. The process wasn't long enough. The tenants will be harmed. The apartments won't be affordable enough for the poorest residents. It should be smaller. It should be somewhere else.
            </p>
            <p>
              When every possible version of a housing project draws this many objections, the objections aren't really about the project. They're about whether housing gets built at all.
            </p>
            <p>
              The council is not choosing between 32 apartments and some ideal development that satisfies every neighbor's aesthetic preferences. It is choosing between 32 new homes and the status quo, which we know isn't working.
            </p>
            <p className="font-semibold text-[var(--color-primary)]">
              That is the choice. Tonight, Urbana can make a different one.
            </p>
          </div>
        </section>

        {/* Bio + back link */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6 space-y-4">
          <p className="text-sm italic text-slate-600">
            Jared Fritz is a longtime Champaign-Urbana resident, a lead member of CUrbanism Club, and serves on the Champaign Zoning Board of Appeals.
          </p>
          <Link
            href="/writings"
            className="block text-sm font-semibold underline underline-offset-2 hover:opacity-70"
          >
            ← Back to Writings
          </Link>
        </div>

      </section>
    </SiteShell>
  );
}
