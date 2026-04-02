import type { Metadata } from "next";
import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import {
  Coffee,
  ExternalLink,
  Facebook,
  Megaphone,
  Mail,
  Map,
  Palette,
} from "lucide-react";

export const metadata: Metadata = {
  title: "The Policy of Possibility | CUrbanism Club",
  description:
    "Support the vision behind The Policy of Possibility and continue the conversation with CUrbanism Club and Abundant CU.",
  openGraph: {
    title: "The Policy of Possibility | CUrbanism Club",
    description:
      "Support the vision behind The Policy of Possibility and continue the conversation with CUrbanism Club and Abundant CU.",
    url: "https://abundantcu.com/curbanism-boneyard",
    images: [{ url: "/Boneyard_Horizontal_BlackRed.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/Boneyard_Horizontal_BlackRed.png"],
  },
};

const NEWSLETTER_URL = "https://actionnetwork.org/forms/sign-up-for-curbanism-news-updates";
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/curbanismclub";
const ABUNDANT_CU_URL = "/data";
const BUILD_PLAN_URL = "https://actionnetwork.org/letters/pass-the-build-plan/?source=abundantcu.com";
const DONATION_URL = "https://curbanism.org/";
const ART_INQUIRY_URL = "mailto:info@curbanism.org?subject=Art%20Inquiry";

function ActionBlock({
  icon: Icon,
  header,
  description,
  href,
  buttonText,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  header: string;
  description: string;
  href?: string;
  buttonText?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-black/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center text-black">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-black">{header}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-[15px]">{description}</p>
          {children ? <div className="mt-4">{children}</div> : null}
          {href && buttonText ? (
            <div className="mt-4">
              <a
                href={href}
                target={href.startsWith("mailto:") || href.startsWith("/") ? undefined : "_blank"}
                rel={href.startsWith("/") ? undefined : "noreferrer"}
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold !text-white transition hover:bg-slate-800 [&_span]:!text-white [&_svg]:!text-white"
                style={{ color: "#ffffff" }}
              >
                <span>{buttonText}</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function CUrbanismBoneyardPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#f3f0e8] text-black">
      <section className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8 md:py-14">
        <header className="rounded-[24px] border border-black/10 bg-white px-6 py-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.04)] md:px-10 md:py-10">
          <div className="relative mx-auto aspect-[2048/629] w-full">
            <Image
              src="/Boneyard_Horizontal_BlackRed.png"
              alt="The Policy of Possibility"
              fill
              priority
              className="object-contain"
            />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-700 md:text-base">
            Thank you for exploring <em>The Policy of Possibility</em> at Boneyard.
            <br />
            <br />
            Better housing choices, more walkable neighborhoods, and a more connected Champaign-Urbana are all within
            reach if we choose to make them possible.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <section>
            <div className="space-y-4">
              <ActionBlock
                icon={Palette}
                header="Inquire About Artwork"
                description="Interested in purchasing art from the exhibit? Contact CUrbanism for pricing info. Many original works, including prints by CUrbanism, renderings by Prof Joseph Altshuler's architecture students, Fraya Replinger, Ivy Santeler, Abby Kipping, and Christina De Angelo, are available."
                href={ART_INQUIRY_URL}
                buttonText="Contact CUrbanism"
              />

              <ActionBlock
                icon={Mail}
                header="Get Policy Updates & Advocacy Alerts"
                description="Join our list to receive local housing news, policy explainers, and calls to action."
                href={NEWSLETTER_URL}
                buttonText="Sign Up for the Newsletter"
              />

              <ActionBlock
                icon={Facebook}
                header="Join the Discussion"
                description="Connect with other residents, share resources, and discuss local housing solutions."
                href={FACEBOOK_GROUP_URL}
                buttonText="CUrbanism Club Facebook Group"
              />
            </div>
          </section>

          <section>
            <div>
              <ActionBlock
                icon={Map}
                header="Like Our Maps? Explore More Data"
                description="View our complete visual analysis of local zoning and land use patterns."
                href={ABUNDANT_CU_URL}
                buttonText="Visit the Data Hub"
              />
            </div>
          </section>

          <section>
            <div>
              <ActionBlock
                icon={Megaphone}
                header="Pass the BUILD Plan"
                description="Illinois cannot solve affordability without building more homes. Send a quick letter urging lawmakers to legalize more housing choices and remove outdated barriers."
                href={BUILD_PLAN_URL}
                buttonText="Send a Letter"
              />
            </div>
          </section>

          <section>
            <div>
              <ActionBlock
                icon={Coffee}
                header="Support Our Work"
                description="Grassroots, community-driven advocacy. Your donations help fund future research, exhibits, and community events."
                href={DONATION_URL}
                buttonText="Buy us a Coffee (Donate)"
              />
            </div>
          </section>

          <footer className="px-4 py-4 text-center md:px-6 md:py-6">
            <p className="text-sm font-medium tracking-[0.02em] text-slate-700 md:text-base">
              Presented by (CU)rbanism Club
            </p>
            <Image
              src="/curbanism logo.jpeg"
              alt="CUrbanism Club"
              width={112}
              height={112}
              className="mx-auto mt-5 h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
            />
          </footer>
        </div>
      </section>
    </main>
  );
}
