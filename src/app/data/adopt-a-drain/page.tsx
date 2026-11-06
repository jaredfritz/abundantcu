import type { Metadata } from "next";
import { Suspense } from "react";
import AdoptADrainClient from "@/components/adopt/AdoptADrainClient";
import SiteShell from "@/components/site/SiteShell";

const description =
  "Adopt a storm drain through the City of Champaign's Adopt-a-Drain program: find an available drain near you, sign up with the City, and log each cleaning.";

export const metadata: Metadata = {
  title: "Adopt a Drain — City of Champaign",
  description,
  alternates: { canonical: "https://abundantcu.com/data/adopt-a-drain" },
  // Sign-in links carry a token in the URL; don't send it to other sites.
  referrer: "no-referrer",
  openGraph: {
    title: "Adopt a Drain — City of Champaign | Abundant CU",
    description,
    url: "https://abundantcu.com/data/adopt-a-drain",
  },
};

export default function AdoptADrainPage() {
  return (
    <SiteShell>
      <Suspense>
        <AdoptADrainClient />
      </Suspense>
    </SiteShell>
  );
}
