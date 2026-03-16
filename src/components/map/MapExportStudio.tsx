"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import PrintMapClient, { ExportLegendConfig, ExportLegendItem } from "@/components/map/PrintMapClient";
import { MapStyleOverrides } from "@/components/ZoningMap";
import { DISTRICTS } from "@/lib/zoning";

type VariantId = "zoning" | "permits" | "build-sfh" | "build-duplex" | "build-cafe";

type VariantDef = {
  id: VariantId;
  label: string;
  mode: "zoning" | "permits" | "build";
  buildTypeId: string;
};

type LegendContent = {
  title: string;
  items: ExportLegendItem[];
};

type LegendPlacementPreset =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-line"
  | "centered"
  | "custom";

type StudioConfig = {
  border?: number;
  labelBoost?: number;
  sizePx?: number;
  dpr?: number;
  export?: {
    sizePx?: number;
    dpr?: number;
    matchPreview?: boolean;
    fastPreviewPx?: number;
  };
  style?: {
    permitSizeScale?: number;
    permitColors?: Partial<typeof PERMIT_COLOR_DEFAULTS>;
    buildColors?: Partial<typeof BUILD_COLOR_DEFAULTS>;
    districtColors?: Partial<typeof DISTRICT_COLOR_DEFAULTS>;
    zoningColors?: Record<string, string>;
  };
  legend?: {
    enabled?: boolean;
    xPct?: number;
    yPct?: number;
    widthPct?: number;
    scale?: number;
    layout?: "column" | "row";
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
  };
  variants?: Partial<Record<VariantId, { legend?: Partial<LegendContent> }>>;
};

const VARIANTS: VariantDef[] = [
  { id: "zoning", label: "Zoning Districts", mode: "zoning", buildTypeId: "duplex" },
  { id: "permits", label: "Residential Permits", mode: "permits", buildTypeId: "duplex" },
  { id: "build-sfh", label: "Build SFA", mode: "build", buildTypeId: "sfh" },
  { id: "build-duplex", label: "Build Duplex", mode: "build", buildTypeId: "duplex" },
  { id: "build-cafe", label: "Build Cafe", mode: "build", buildTypeId: "cafe" },
];

const DISTRICT_COLOR_DEFAULTS = {
  residential: "#93c5fd",
  inTown: "#c4b5fd",
  commercial: "#fcd34d",
  industrial: "#fb923c",
};

const BUILD_COLOR_DEFAULTS = {
  allowed: "#1F6CB0",
  provisional: "#D28A00",
  notAllowed: "#B2415C",
};

const PERMIT_COLOR_DEFAULTS = {
  sf: "#1F6CB0",
  mf: "#B9387A",
  other: "#6b7280",
};

const LEGEND_PRESET_OPTIONS: Array<{ id: LegendPlacementPreset; label: string }> = [
  { id: "top-left", label: "Top Left" },
  { id: "top-right", label: "Top Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-right", label: "Bottom Right" },
  { id: "bottom-line", label: "Single Line Bottom" },
  { id: "centered", label: "Centered" },
  { id: "custom", label: "Custom" },
];

function defaultLegendForVariant(
  variant: VariantId,
  colors?: {
    district: typeof DISTRICT_COLOR_DEFAULTS;
    build: typeof BUILD_COLOR_DEFAULTS;
    permit: typeof PERMIT_COLOR_DEFAULTS;
  }
): LegendContent {
  const district = colors?.district ?? DISTRICT_COLOR_DEFAULTS;
  const build = colors?.build ?? BUILD_COLOR_DEFAULTS;
  const permit = colors?.permit ?? PERMIT_COLOR_DEFAULTS;

  if (variant === "zoning") {
    return {
      title: "Zoning Districts",
      items: [
        { label: "Residential", color: district.residential },
        { label: "In-Town", color: district.inTown },
        { label: "Commercial", color: district.commercial },
        { label: "Industrial", color: district.industrial },
      ],
    };
  }
  if (variant === "permits") {
    return {
      title: "Residential Permits 2014-2024",
      items: [
        { label: "Single-family (SF)", color: permit.sf, shape: "circle" },
        { label: "Multifamily (MF)", color: permit.mf, shape: "circle" },
      ],
    };
  }
  if (variant === "build-sfh") {
    return {
      title: "Single Family Home",
      items: [
        { label: "Allowed by right", color: build.allowed },
        { label: "Not allowed", color: build.notAllowed, hatch: true },
      ],
    };
  }
  if (variant === "build-duplex") {
    return {
      title: "Duplex",
      items: [
        { label: "Allowed by right", color: build.allowed },
        { label: "Not allowed", color: build.notAllowed, hatch: true },
      ],
    };
  }
  return {
    title: "Cafe",
    items: [
      { label: "Allowed by right", color: build.allowed },
      { label: "Provisional", color: build.provisional },
      { label: "Not allowed", color: build.notAllowed, hatch: true },
    ],
  };
}

function createLegendState(): Record<VariantId, LegendContent> {
  return {
    zoning: defaultLegendForVariant("zoning"),
    permits: defaultLegendForVariant("permits"),
    "build-sfh": defaultLegendForVariant("build-sfh"),
    "build-duplex": defaultLegendForVariant("build-duplex"),
    "build-cafe": defaultLegendForVariant("build-cafe"),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function legendPresetValues(preset: Exclude<LegendPlacementPreset, "custom">): {
  xPct: number;
  yPct: number;
  widthPct: number;
  scale: number;
  layout: "column" | "row";
} {
  if (preset === "top-left") return { xPct: 0.03, yPct: 0.03, widthPct: 0.26, scale: 1, layout: "column" };
  if (preset === "top-right") return { xPct: 0.71, yPct: 0.03, widthPct: 0.26, scale: 1, layout: "column" };
  if (preset === "bottom-left") return { xPct: 0.03, yPct: 0.74, widthPct: 0.3, scale: 1, layout: "column" };
  if (preset === "bottom-right") return { xPct: 0.67, yPct: 0.74, widthPct: 0.3, scale: 1, layout: "column" };
  if (preset === "bottom-line") return { xPct: 0.05, yPct: 0.95, widthPct: 0.95, scale: 0.9, layout: "row" };
  return { xPct: 0.33, yPct: 0.42, widthPct: 0.34, scale: 1, layout: "column" };
}

function encodeJsonBase64Url(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function variantFromId(variantId: VariantId): VariantDef {
  return VARIANTS.find((variant) => variant.id === variantId) ?? VARIANTS[0];
}

function variantFilename(variantId: VariantId): string {
  if (variantId === "zoning") return "01-zoning-districts.png";
  if (variantId === "permits") return "02-residential-permits.png";
  if (variantId === "build-sfh") return "03-build-single-family-home.png";
  if (variantId === "build-duplex") return "04-build-duplex.png";
  return "05-build-cafe.png";
}

function pickDistrictColorFromZoningColors(
  zoningColors: Record<string, string> | undefined,
  districtId: "residential" | "in-town" | "commercial" | "industrial",
  fallback: string
): string {
  if (!zoningColors) return fallback;
  const district = DISTRICTS.find((item) => item.id === districtId);
  if (!district) return fallback;

  for (const subgroup of district.subgroups) {
    for (const code of subgroup.codes) {
      const candidate = zoningColors[code.code];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }
  }
  return fallback;
}

function sanitizeLegendItems(value: unknown, fallback: ExportLegendItem[]): ExportLegendItem[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item): ExportLegendItem | null => {
      if (!item || typeof item !== "object") return null;
      const maybe = item as Partial<ExportLegendItem>;
      if (typeof maybe.label !== "string" || typeof maybe.color !== "string") return null;
      return {
        label: maybe.label,
        color: maybe.color,
        shape: maybe.shape === "circle" ? "circle" : "square",
        hatch: Boolean(maybe.hatch),
      };
    })
    .filter((item): item is ExportLegendItem => item !== null);
  return normalized.length > 0 ? normalized : fallback;
}

export default function MapExportStudio() {
  const configFileInputRef = useRef<HTMLInputElement | null>(null);
  const [variantId, setVariantId] = useState<VariantId>("zoning");
  const [borderRatio, setBorderRatio] = useState(0.035);
  const [labelBoost, setLabelBoost] = useState(6);
  const [districtColors, setDistrictColors] = useState(DISTRICT_COLOR_DEFAULTS);
  const [buildColors, setBuildColors] = useState(BUILD_COLOR_DEFAULTS);
  const [permitColors, setPermitColors] = useState(PERMIT_COLOR_DEFAULTS);
  const [permitSizeScale, setPermitSizeScale] = useState(0.8);
  const [legendEnabled, setLegendEnabled] = useState(true);
  const [legendPlacementPreset, setLegendPlacementPreset] = useState<LegendPlacementPreset>("bottom-line");
  const [legendXPct, setLegendXPct] = useState(0.05);
  const [legendYPct, setLegendYPct] = useState(0.95);
  const [legendWidthPct, setLegendWidthPct] = useState(0.95);
  const [legendScale, setLegendScale] = useState(0.9);
  const [legendLayout, setLegendLayout] = useState<"column" | "row">("row");
  const [legendBackgroundColor, setLegendBackgroundColor] = useState("rgba(255,255,255,0.94)");
  const [legendBorderColor, setLegendBorderColor] = useState("rgba(17,24,39,0.16)");
  const [legendTextColor, setLegendTextColor] = useState("#1f2937");
  const [exportSizePx, setExportSizePx] = useState(4096);
  const [exportDpr, setExportDpr] = useState(2);
  const [matchExportPreview, setMatchExportPreview] = useState(true);
  const [fastPreviewPx, setFastPreviewPx] = useState(1200);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [legendByVariant, setLegendByVariant] = useState<Record<VariantId, LegendContent>>(
    createLegendState()
  );

  const activeVariant = variantFromId(variantId);
  const activeLegend = legendByVariant[variantId];

  const zoningColorOverrides = useMemo(() => {
    const overrideByCode: Record<string, string> = {};
    for (const district of DISTRICTS) {
      let color = districtColors.residential;
      if (district.id === "in-town") color = districtColors.inTown;
      if (district.id === "commercial") color = districtColors.commercial;
      if (district.id === "industrial") color = districtColors.industrial;
      for (const subgroup of district.subgroups) {
        for (const code of subgroup.codes) {
          overrideByCode[code.code] = color;
        }
      }
    }
    return overrideByCode;
  }, [districtColors]);

  const styleOverrides = useMemo<MapStyleOverrides>(() => {
    return {
      zoningColors: zoningColorOverrides,
      buildColors,
      permitColors,
      permitSizeScale,
    };
  }, [buildColors, permitColors, permitSizeScale, zoningColorOverrides]);

  const legendConfig = useMemo<ExportLegendConfig>(() => {
    return {
      enabled: legendEnabled,
      xPct: legendXPct,
      yPct: legendYPct,
      widthPct: legendWidthPct,
      scale: legendScale,
      layout: legendLayout,
      backgroundColor: legendBackgroundColor,
      borderColor: legendBorderColor,
      textColor: legendTextColor,
      title: activeLegend.title,
      items: activeLegend.items,
    };
  }, [
    activeLegend.items,
    activeLegend.title,
    legendBackgroundColor,
    legendBorderColor,
    legendEnabled,
    legendLayout,
    legendScale,
    legendTextColor,
    legendWidthPct,
    legendXPct,
    legendYPct,
  ]);

  const printRouteUrl = useMemo(() => {
    const params = new URLSearchParams({
      mode: activeVariant.mode,
      border: String(borderRatio),
      labelBoost: String(labelBoost),
      buildType: activeVariant.buildTypeId,
      style: encodeJsonBase64Url(styleOverrides),
      legend: encodeJsonBase64Url(legendConfig),
    });
    return `/data/zoning/print?${params.toString()}`;
  }, [activeVariant.buildTypeId, activeVariant.mode, borderRatio, labelBoost, legendConfig, styleOverrides]);

  const exportViewportPx = useMemo(
    () => Math.max(256, Math.round(exportSizePx / exportDpr)),
    [exportDpr, exportSizePx]
  );
  const previewRenderPx = matchExportPreview
    ? exportViewportPx
    : clamp(Math.round(fastPreviewPx), 512, 4096);
  const previewScale = clamp(900 / previewRenderPx, 0.1, 1);
  const previewDisplayPx = Math.round(previewRenderPx * previewScale);
  const exportMegapixels = (exportSizePx * exportSizePx) / 1_000_000;

  function applyLegendPreset(preset: LegendPlacementPreset) {
    setLegendPlacementPreset(preset);
    if (preset === "custom") return;
    const next = legendPresetValues(preset);
    setLegendXPct(next.xPct);
    setLegendYPct(next.yPct);
    setLegendWidthPct(next.widthPct);
    setLegendScale(next.scale);
    setLegendLayout(next.layout);
  }

  function markLegendPresetCustom() {
    setLegendPlacementPreset("custom");
  }

  function updateLegendTitle(nextTitle: string) {
    setLegendByVariant((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], title: nextTitle },
    }));
  }

  function updateLegendItem(index: number, patch: Partial<ExportLegendItem>) {
    setLegendByVariant((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        items: prev[variantId].items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
    }));
  }

  function removeLegendItem(index: number) {
    setLegendByVariant((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        items: prev[variantId].items.filter((_, i) => i !== index),
      },
    }));
  }

  function addLegendItem() {
    setLegendByVariant((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        items: [
          ...prev[variantId].items,
          { label: "New item", color: "#4b5563", shape: "square" },
        ],
      },
    }));
  }

  function resetLegendForActiveVariant() {
    setLegendByVariant((prev) => ({
      ...prev,
      [variantId]: defaultLegendForVariant(variantId, {
        district: districtColors,
        build: buildColors,
        permit: permitColors,
      }),
    }));
  }

  function downloadConfigJson() {
    const config = {
      border: Number(borderRatio.toFixed(3)),
      labelBoost,
      export: {
        sizePx: Math.round(exportSizePx),
        dpr: Number(exportDpr.toFixed(2)),
        matchPreview: matchExportPreview,
        fastPreviewPx: Math.round(fastPreviewPx),
      },
      style: {
        permitSizeScale: Number(permitSizeScale.toFixed(2)),
        permitColors,
        buildColors,
        districtColors,
        zoningColors: zoningColorOverrides,
      },
      legend: {
        enabled: legendEnabled,
        xPct: Number(legendXPct.toFixed(3)),
        yPct: Number(legendYPct.toFixed(3)),
        widthPct: Number(legendWidthPct.toFixed(3)),
        scale: Number(legendScale.toFixed(2)),
        layout: legendLayout,
        backgroundColor: legendBackgroundColor,
        borderColor: legendBorderColor,
        textColor: legendTextColor,
      },
      variants: {
        zoning: { legend: legendByVariant.zoning },
        permits: { legend: legendByVariant.permits },
        "build-sfh": { legend: legendByVariant["build-sfh"] },
        "build-duplex": { legend: legendByVariant["build-duplex"] },
        "build-cafe": { legend: legendByVariant["build-cafe"] },
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "map-print.config.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyImportedConfig(config: StudioConfig) {
    if (typeof config.border === "number") {
      setBorderRatio(clamp(config.border, 0, 0.2));
    }
    if (typeof config.labelBoost === "number") {
      setLabelBoost(clamp(Math.round(config.labelBoost), 0, 8));
    }

    const exportConfig = config.export;
    const importedSizePx = typeof exportConfig?.sizePx === "number"
      ? exportConfig.sizePx
      : typeof config.sizePx === "number"
        ? config.sizePx
        : null;
    if (typeof importedSizePx === "number") {
      setExportSizePx(clamp(Math.round(importedSizePx), 512, 12000));
    }
    const importedDpr = typeof exportConfig?.dpr === "number"
      ? exportConfig.dpr
      : typeof config.dpr === "number"
        ? config.dpr
        : null;
    if (typeof importedDpr === "number") {
      setExportDpr(clamp(importedDpr, 1, 4));
    }
    if (typeof exportConfig?.matchPreview === "boolean") {
      setMatchExportPreview(exportConfig.matchPreview);
    }
    if (typeof exportConfig?.fastPreviewPx === "number") {
      setFastPreviewPx(clamp(Math.round(exportConfig.fastPreviewPx), 512, 4096));
    }

    const style = config.style;
    if (typeof style?.permitSizeScale === "number") {
      setPermitSizeScale(clamp(style.permitSizeScale, 0.25, 3));
    }
    if (style?.permitColors) {
      setPermitColors((prev) => ({
        sf: typeof style.permitColors?.sf === "string" ? style.permitColors.sf : prev.sf,
        mf: typeof style.permitColors?.mf === "string" ? style.permitColors.mf : prev.mf,
        other: typeof style.permitColors?.other === "string" ? style.permitColors.other : prev.other,
      }));
    }
    if (style?.buildColors) {
      setBuildColors((prev) => ({
        allowed: typeof style.buildColors?.allowed === "string" ? style.buildColors.allowed : prev.allowed,
        provisional: typeof style.buildColors?.provisional === "string" ? style.buildColors.provisional : prev.provisional,
        notAllowed: typeof style.buildColors?.notAllowed === "string" ? style.buildColors.notAllowed : prev.notAllowed,
      }));
    }
    if (style?.districtColors || style?.zoningColors) {
      setDistrictColors((prev) => {
        const district = style.districtColors;
        const zoningColors = style.zoningColors;
        return {
          residential: typeof district?.residential === "string"
            ? district.residential
            : pickDistrictColorFromZoningColors(zoningColors, "residential", prev.residential),
          inTown: typeof district?.inTown === "string"
            ? district.inTown
            : pickDistrictColorFromZoningColors(zoningColors, "in-town", prev.inTown),
          commercial: typeof district?.commercial === "string"
            ? district.commercial
            : pickDistrictColorFromZoningColors(zoningColors, "commercial", prev.commercial),
          industrial: typeof district?.industrial === "string"
            ? district.industrial
            : pickDistrictColorFromZoningColors(zoningColors, "industrial", prev.industrial),
        };
      });
    }

    if (config.legend) {
      setLegendPlacementPreset("custom");
      if (typeof config.legend.enabled === "boolean") setLegendEnabled(config.legend.enabled);
      if (typeof config.legend.xPct === "number") setLegendXPct(clamp(config.legend.xPct, 0, 0.95));
      if (typeof config.legend.yPct === "number") setLegendYPct(clamp(config.legend.yPct, 0, 0.95));
      if (typeof config.legend.widthPct === "number") setLegendWidthPct(clamp(config.legend.widthPct, 0.1, 0.95));
      if (typeof config.legend.scale === "number") setLegendScale(clamp(config.legend.scale, 0.5, 3));
      if (config.legend.layout === "column" || config.legend.layout === "row") setLegendLayout(config.legend.layout);
      if (typeof config.legend.backgroundColor === "string") setLegendBackgroundColor(config.legend.backgroundColor);
      if (typeof config.legend.borderColor === "string") setLegendBorderColor(config.legend.borderColor);
      if (typeof config.legend.textColor === "string") setLegendTextColor(config.legend.textColor);
    }

    if (config.variants) {
      setLegendByVariant((prev) => {
        const next: Record<VariantId, LegendContent> = { ...prev };
        for (const id of VARIANTS.map((item) => item.id)) {
          const incomingLegend = config.variants?.[id]?.legend;
          if (!incomingLegend) continue;
          next[id] = {
            title: typeof incomingLegend.title === "string" ? incomingLegend.title : prev[id].title,
            items: sanitizeLegendItems(incomingLegend.items, prev[id].items),
          };
        }
        return next;
      });
    }
  }

  async function handleConfigImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as StudioConfig;
      applyImportedConfig(parsed);
      setExportStatus(`Loaded config: ${file.name}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? `Config import failed: ${error.message}` : "Config import failed");
    } finally {
      event.currentTarget.value = "";
    }
  }

  const buildLegendConfigForVariant = useCallback((id: VariantId): ExportLegendConfig => {
    return {
      enabled: legendEnabled,
      xPct: legendXPct,
      yPct: legendYPct,
      widthPct: legendWidthPct,
      scale: legendScale,
      layout: legendLayout,
      backgroundColor: legendBackgroundColor,
      borderColor: legendBorderColor,
      textColor: legendTextColor,
      title: legendByVariant[id].title,
      items: legendByVariant[id].items,
    };
  }, [
    legendBackgroundColor,
    legendBorderColor,
    legendByVariant,
    legendEnabled,
    legendLayout,
    legendScale,
    legendTextColor,
    legendWidthPct,
    legendXPct,
    legendYPct,
  ]);

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportVariantImage(variant: VariantDef) {
    const response = await fetch("/api/map-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: variant.mode,
        buildTypeId: variant.buildTypeId,
        borderRatio,
        labelBoost,
        sizePx: exportSizePx,
        dpr: exportDpr,
        styleOverrides,
        legendConfig: buildLegendConfigForVariant(variant.id),
        filename: variantFilename(variant.id),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Export failed (${response.status})`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition");
    const headerFilename = disposition?.match(/filename=\"?([^\";]+)\"?/)?.[1];
    saveBlob(blob, headerFilename ?? variantFilename(variant.id));
  }

  async function handleExportCurrent() {
    if (isExporting) return;
    setIsExporting(true);
    setExportStatus(`Exporting ${activeVariant.label}...`);
    try {
      await exportVariantImage(activeVariant);
      setExportStatus(`Saved ${activeVariant.label}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportAll() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      for (const variant of VARIANTS) {
        setExportStatus(`Exporting ${variant.label}...`);
        await exportVariantImage(variant);
      }
      setExportStatus("Saved all five images");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 text-base font-semibold text-slate-900">Map Export Studio</div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Preview Variant</label>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value as VariantId)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {VARIANTS.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">Layout</div>
          <label className="mb-1 block text-xs text-slate-600">Border ({Math.round(borderRatio * 100)}%)</label>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.005}
            value={borderRatio}
            onChange={(event) => setBorderRatio(clamp(Number(event.target.value), 0, 0.2))}
            className="mb-2 w-full"
          />
          <label className="mb-1 block text-xs text-slate-600">Road Label Boost ({labelBoost})</label>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={labelBoost}
            onChange={(event) => setLabelBoost(clamp(Number(event.target.value), 0, 8))}
            className="w-full"
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label>
              Export Size (px)
              <input
                type="number"
                min={512}
                max={12000}
                step={256}
                value={exportSizePx}
                onChange={(event) => setExportSizePx(clamp(Number(event.target.value), 512, 12000))}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label>
              DPR
              <input
                type="number"
                min={1}
                max={4}
                step={0.25}
                value={exportDpr}
                onChange={(event) => setExportDpr(clamp(Number(event.target.value), 1, 4))}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Final output is square: {Math.round(exportSizePx)} x {Math.round(exportSizePx)} px
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Approx raster load: {exportMegapixels.toFixed(1)} MP
          </div>
          <label className="mt-3 mb-1 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={matchExportPreview}
              onChange={(event) => setMatchExportPreview(event.target.checked)}
            />
            Match export render size in preview (slower)
          </label>
          {!matchExportPreview && (
            <label className="block text-xs text-slate-600">
              Fast Preview Render (px)
              <input
                type="number"
                min={512}
                max={4096}
                step={128}
                value={fastPreviewPx}
                onChange={(event) => setFastPreviewPx(clamp(Number(event.target.value), 512, 4096))}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          )}
          <div className="mt-1 text-[11px] text-slate-500">
            Preview render: {previewRenderPx} px ({matchExportPreview ? "matched" : "fast"})
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">Overlay Colors</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center justify-between gap-2">
              Residential
              <input type="color" value={districtColors.residential} onChange={(event) => setDistrictColors((prev) => ({ ...prev, residential: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              In-Town
              <input type="color" value={districtColors.inTown} onChange={(event) => setDistrictColors((prev) => ({ ...prev, inTown: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Commercial
              <input type="color" value={districtColors.commercial} onChange={(event) => setDistrictColors((prev) => ({ ...prev, commercial: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Industrial
              <input type="color" value={districtColors.industrial} onChange={(event) => setDistrictColors((prev) => ({ ...prev, industrial: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Build Allowed
              <input type="color" value={buildColors.allowed} onChange={(event) => setBuildColors((prev) => ({ ...prev, allowed: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Build Provisional
              <input type="color" value={buildColors.provisional} onChange={(event) => setBuildColors((prev) => ({ ...prev, provisional: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Build Not Allowed
              <input type="color" value={buildColors.notAllowed} onChange={(event) => setBuildColors((prev) => ({ ...prev, notAllowed: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Permit SF
              <input type="color" value={permitColors.sf} onChange={(event) => setPermitColors((prev) => ({ ...prev, sf: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Permit MF
              <input type="color" value={permitColors.mf} onChange={(event) => setPermitColors((prev) => ({ ...prev, mf: event.target.value }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Permit Other
              <input type="color" value={permitColors.other} onChange={(event) => setPermitColors((prev) => ({ ...prev, other: event.target.value }))} />
            </label>
          </div>
          <label className="mt-2 block text-xs text-slate-600">
            Permit Size Scale ({permitSizeScale.toFixed(2)})
          </label>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={permitSizeScale}
            onChange={(event) => setPermitSizeScale(clamp(Number(event.target.value), 0.25, 3))}
            className="w-full"
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">Legend</div>
          <label className="mb-2 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={legendEnabled}
              onChange={(event) => setLegendEnabled(event.target.checked)}
            />
            Include Legend
          </label>

          <label className="mb-1 block text-xs text-slate-600">Location Preset</label>
          <select
            value={legendPlacementPreset}
            onChange={(event) => applyLegendPreset(event.target.value as LegendPlacementPreset)}
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {LEGEND_PRESET_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs text-slate-600">Title</label>
          <input
            type="text"
            value={activeLegend.title}
            onChange={(event) => updateLegendTitle(event.target.value)}
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>
              X (%)
              <input
                type="number"
                min={0}
                max={90}
                step={1}
                value={Math.round(legendXPct * 100)}
                onChange={(event) => {
                  markLegendPresetCustom();
                  setLegendXPct(clamp(Number(event.target.value) / 100, 0, 0.95));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label>
              Y (%)
              <input
                type="number"
                min={0}
                max={90}
                step={1}
                value={Math.round(legendYPct * 100)}
                onChange={(event) => {
                  markLegendPresetCustom();
                  setLegendYPct(clamp(Number(event.target.value) / 100, 0, 0.95));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label>
              Width (%)
              <input
                type="number"
                min={10}
                max={95}
                step={1}
                value={Math.round(legendWidthPct * 100)}
                onChange={(event) => {
                  markLegendPresetCustom();
                  setLegendWidthPct(clamp(Number(event.target.value) / 100, 0.1, 0.95));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label>
              Scale
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.1}
                value={legendScale}
                onChange={(event) => {
                  markLegendPresetCustom();
                  setLegendScale(clamp(Number(event.target.value), 0.5, 3));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label>
              Layout
              <select
                value={legendLayout}
                onChange={(event) => {
                  markLegendPresetCustom();
                  setLegendLayout(event.target.value as "column" | "row");
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="column">Stacked</option>
                <option value="row">Single line / row</option>
              </select>
            </label>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
            <label className="flex items-center justify-between gap-2">
              Background
              <input
                type="text"
                value={legendBackgroundColor}
                onChange={(event) => setLegendBackgroundColor(event.target.value)}
                className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Border
              <input
                type="text"
                value={legendBorderColor}
                onChange={(event) => setLegendBorderColor(event.target.value)}
                className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Text
              <input
                type="text"
                value={legendTextColor}
                onChange={(event) => setLegendTextColor(event.target.value)}
                className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>

          <div className="mt-3 mb-2 flex gap-2">
            <button
              onClick={addLegendItem}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
            >
              Add Item
            </button>
            <button
              onClick={resetLegendForActiveVariant}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
            >
              Sync Legend to Colors
            </button>
          </div>

          <div className="max-h-56 space-y-2 overflow-auto pr-1">
            {activeLegend.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded border border-slate-200 p-2">
                <label className="mb-1 block text-xs text-slate-600">Label</label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(event) => updateLegendItem(index, { label: event.target.value })}
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="color"
                    value={item.color}
                    onChange={(event) => updateLegendItem(index, { color: event.target.value })}
                  />
                  <select
                    value={item.shape ?? "square"}
                    onChange={(event) => updateLegendItem(index, { shape: event.target.value as "square" | "circle" })}
                    className="rounded border border-slate-300 px-1 py-1 text-xs"
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                  </select>
                  <label className="flex items-center justify-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(item.hatch)}
                      onChange={(event) => updateLegendItem(index, { hatch: event.target.checked })}
                    />
                    Hatch
                  </label>
                </div>
                <button
                  onClick={() => removeLegendItem(index)}
                  className="mt-2 rounded border border-rose-300 px-2 py-1 text-xs text-rose-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleExportCurrent}
            disabled={isExporting}
            className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Download Current PNG
          </button>
          <button
            onClick={handleExportAll}
            disabled={isExporting}
            className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            Download All 5 PNGs
          </button>
          <button
            onClick={downloadConfigJson}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Download Config JSON
          </button>
          <button
            onClick={() => configFileInputRef.current?.click()}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Import Config JSON
          </button>
          <input
            ref={configFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleConfigImportFile}
          />
          <a
            href={printRouteUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Open Full Preview
          </a>
        </div>
        {exportStatus && (
          <div className="mt-2 text-xs text-slate-600">{exportStatus}</div>
        )}
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-800">Live Export Preview</div>
        <div className="mb-2 text-xs text-slate-500">
          Rendered at {previewRenderPx} x {previewRenderPx}, displayed at {previewDisplayPx} x {previewDisplayPx}
        </div>
        <div className="mx-auto aspect-square w-full max-w-[900px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex min-h-full w-full items-start justify-center">
            <div
              style={{
                width: `${previewDisplayPx}px`,
                height: `${previewDisplayPx}px`,
              }}
            >
              <div
                style={{
                  width: `${previewRenderPx}px`,
                  height: `${previewRenderPx}px`,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <PrintMapClient
                  mode={activeVariant.mode}
                  buildTypeId={activeVariant.buildTypeId}
                  borderRatio={borderRatio}
                  labelBoost={labelBoost}
                  styleOverrides={styleOverrides}
                  legendConfig={legendConfig}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
