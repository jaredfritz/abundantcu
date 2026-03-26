import type { Metadata } from "next";
import ParkingMapper from "@/components/tools/ParkingMapper";

export const metadata: Metadata = {
  title: "Parking Map Print Export",
  robots: {
    index: false,
    follow: false,
  },
};

type Basemap = "roadmap" | "satellite";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function getBasemap(value: string | null): Basemap {
  if (value === "roadmap") return "roadmap";
  return "satellite";
}

function getTilt(value: string | null): boolean {
  return value === "1" || value === "true";
}

export default async function ParkingPrintPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const basemap = getBasemap(getFirst(params.basemap));
  const tiltOn = getTilt(getFirst(params.tilt));

  return (
    <main id="parking-print-root" className="h-screen w-screen overflow-hidden bg-white">
      <ParkingMapper editMode={false} captureMode initialBasemap={basemap} initialTilt={tiltOn} />
    </main>
  );
}
