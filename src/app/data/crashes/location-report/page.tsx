import type { Metadata } from "next";
import LocationReport from "@/components/crashes/LocationReport";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Location Crash Report — Champaign County",
  description:
    "Crash report for any town, street, or intersection in Champaign County: costs, causes, injuries, and trends from IDOT crash data.",
  openGraph: {
    title: "Location Crash Report — Champaign County | Abundant CU",
    description:
      "Crash report for any town, street, or intersection in Champaign County: costs, causes, injuries, and trends from IDOT crash data.",
    url: "https://abundantcu.com/data/crashes/location-report",
  },
};

export default function LocationReportPage() {
  return (
    <SiteShell>
      <LocationReport />
    </SiteShell>
  );
}
