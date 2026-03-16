import type { Metadata } from "next";
import SiteShell from "@/components/site/SiteShell";
import MapExportStudio from "@/components/map/MapExportStudio";

export const metadata: Metadata = {
  title: "Map Export Studio",
  description: "Customize high-resolution map export styles, legend layout, and preview output.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MapExportStudioPage() {
  return (
    <SiteShell>
      <main className="min-h-[calc(100dvh-69px)] bg-slate-50 p-3 md:p-4">
        <MapExportStudio />
      </main>
    </SiteShell>
  );
}
