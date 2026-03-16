import type { Metadata } from "next";
import PrintMapClient from "@/components/map/PrintMapClient";
import type { ExportLegendConfig } from "@/components/map/PrintMapClient";
import type { MapStyleOverrides } from "@/components/ZoningMap";

export const metadata: Metadata = {
  title: "Map Print Export",
  robots: {
    index: false,
    follow: false,
  },
};

type PrintMode = "zoning" | "permits" | "build";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function getMode(value: string | null): PrintMode {
  if (value === "permits" || value === "build") return value;
  return "zoning";
}

function getFloat(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
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

export default async function ZoningPrintPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const mode = getMode(getFirst(params.mode));
  const buildTypeId = getFirst(params.buildType) ?? "duplex";
  const borderRatio = Math.min(Math.max(getFloat(getFirst(params.border), 0.1), 0), 0.3);
  const labelBoost = Math.min(Math.max(getInt(getFirst(params.labelBoost), 4), 0), 8);
  const styleOverrides = decodeBase64JsonParam<MapStyleOverrides>(getFirst(params.style));
  const legendConfig = decodeBase64JsonParam<ExportLegendConfig>(getFirst(params.legend));

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <PrintMapClient
        mode={mode}
        buildTypeId={buildTypeId}
        borderRatio={borderRatio}
        labelBoost={labelBoost}
        styleOverrides={styleOverrides}
        legendConfig={legendConfig}
      />
    </main>
  );
}
