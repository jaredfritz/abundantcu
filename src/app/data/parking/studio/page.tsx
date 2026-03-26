import type { Metadata } from "next";
import SiteShell from "@/components/site/SiteShell";
import ParkingExportStudio from "@/components/map/ParkingExportStudio";

export const metadata: Metadata = {
  title: "Parking Capture Studio",
  description: "Capture high-resolution screenshots from the downtown parking map.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParkingCaptureStudioPage() {
  return (
    <SiteShell>
      <main className="min-h-[calc(100dvh-69px)] bg-slate-50 p-3 md:p-4">
        <ParkingExportStudio />
      </main>
    </SiteShell>
  );
}
