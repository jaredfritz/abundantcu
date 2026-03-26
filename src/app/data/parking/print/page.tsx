import type { Metadata } from "next";
import ParkingMapper from "@/components/tools/ParkingMapper";
import type { ParkingBasemap, ParkingLegendConfig, ParkingStyleOverrides } from "@/lib/parkingExport";
import { loadParkingFeaturesForCapture } from "@/lib/parkingFeatures.server";

export const metadata: Metadata = {
  title: "Parking Map Print Export",
  robots: {
    index: false,
    follow: false,
  },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function getBasemap(value: string | null): ParkingBasemap {
  if (value === "roadmap") return "roadmap";
  return "satellite";
}

function getTilt(value: string | null): boolean {
  return value === "1" || value === "true";
}

function getFloat(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeBase64JsonParam<T extends object>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export default async function ParkingPrintPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const basemap = getBasemap(getFirst(params.basemap));
  const tiltOn = getTilt(getFirst(params.tilt));
  const borderRatio = Math.max(0, Math.min(0.18, getFloat(getFirst(params.border), 0)));
  const roadLabelBoost = Math.max(0, Math.min(8, Math.round(getFloat(getFirst(params.labelBoost), 0))));
  const styleOverrides = decodeBase64JsonParam<ParkingStyleOverrides>(getFirst(params.style));
  const legendConfig = decodeBase64JsonParam<ParkingLegendConfig>(getFirst(params.legend));
  const { features, error } = await loadParkingFeaturesForCapture();

  return (
    <main id="parking-print-root" className="h-screen w-screen overflow-hidden bg-white">
      <ParkingMapper
        editMode={false}
        captureMode
        captureFillParent
        initialBasemap={basemap}
        initialTilt={tiltOn}
        roadLabelBoost={roadLabelBoost}
        fitToFeaturesBorderRatio={borderRatio}
        styleOverrides={styleOverrides}
        captureLegendConfig={legendConfig}
        initialFeatures={features}
        initialFeatureError={error}
      />
    </main>
  );
}
