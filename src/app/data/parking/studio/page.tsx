import type { Metadata } from "next";
import SiteShell from "@/components/site/SiteShell";
import ParkingExportStudio from "@/components/map/ParkingExportStudio";
import { loadParkingFeaturesForCapture } from "@/lib/parkingFeatures.server";

export const metadata: Metadata = {
  title: "Parking Capture Studio",
  description: "Capture high-resolution screenshots from the downtown parking map.",
  robots: {
    index: false,
    follow: false,
  },
};
export const dynamic = "force-dynamic";

export default async function ParkingCaptureStudioPage() {
  const { features, error } = await loadParkingFeaturesForCapture();

  return (
    <SiteShell>
      <main className="min-h-[calc(100dvh-69px)] bg-slate-50 p-3 md:p-4">
        <ParkingExportStudio initialFeatures={features} initialFeatureError={error} />
      </main>
    </SiteShell>
  );
}
