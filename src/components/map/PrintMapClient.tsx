"use client";

import { useCallback, useEffect, useMemo } from "react";
import ZoningMap, { MapStyleOverrides } from "@/components/ZoningMap";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useZoningData } from "@/hooks/useZoningData";
import { BUILD_TYPES } from "@/lib/buildTypes";
import { ALL_ZONE_CODES, DISTRICTS } from "@/lib/zoning";
import permitsDataJson from "@/data/residential-permits.json";

type PrintMode = "zoning" | "permits" | "build";

interface PrintMapClientProps {
  mode: PrintMode;
  buildTypeId: string;
  borderRatio: number;
  labelBoost: number;
  styleOverrides?: MapStyleOverrides;
  legendConfig?: ExportLegendConfig;
}

const EMPTY_CODES = new Set<string>();

export interface ExportLegendItem {
  label: string;
  color: string;
  shape?: "square" | "circle";
  hatch?: boolean;
}

export interface ExportLegendConfig {
  enabled?: boolean;
  title?: string;
  items?: ExportLegendItem[];
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  scale?: number;
  layout?: "column" | "row";
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PrintMapClient({
  mode,
  buildTypeId,
  borderRatio,
  labelBoost,
  styleOverrides,
  legendConfig,
}: PrintMapClientProps) {
  const data = useZoningData();
  const permitsData = useMemo(() => {
    const maybeModule = permitsDataJson as GeoJSON.FeatureCollection & {
      default?: GeoJSON.FeatureCollection;
    };
    return (maybeModule.default ?? maybeModule) as GeoJSON.FeatureCollection;
  }, []);

  const buildType = useMemo(() => {
    if (mode !== "build") return null;
    return BUILD_TYPES.find((bt) => bt.id === buildTypeId)
      ?? BUILD_TYPES.find((bt) => bt.id === "duplex")
      ?? BUILD_TYPES[0]
      ?? null;
  }, [buildTypeId, mode]);

  const activeCodes = useMemo(
    () => (mode === "permits" ? EMPTY_CODES : new Set(ALL_ZONE_CODES)),
    [mode]
  );

  const defaultLegendItems = useMemo<ExportLegendItem[]>(() => {
    if (mode === "permits") {
      return [
        {
          label: "Single-family (SF)",
          color: styleOverrides?.permitColors?.sf ?? "#1F6CB0",
          shape: "circle",
        },
        {
          label: "Multifamily (MF)",
          color: styleOverrides?.permitColors?.mf ?? "#B9387A",
          shape: "circle",
        },
      ];
    }

    if (mode === "build") {
      return [
        {
          label: "Allowed by right",
          color: styleOverrides?.buildColors?.allowed ?? "#1F6CB0",
        },
        {
          label: "Provisional",
          color: styleOverrides?.buildColors?.provisional ?? "#D28A00",
        },
        {
          label: "Not allowed",
          color: styleOverrides?.buildColors?.notAllowed ?? "#B2415C",
          hatch: true,
        },
      ];
    }

    return DISTRICTS.map((district) => ({
      label: district.shortLabel,
      color: district.color,
    }));
  }, [mode, styleOverrides]);

  const legend = useMemo(() => {
    const enabled = legendConfig?.enabled ?? true;
    const xPct = clamp(legendConfig?.xPct ?? 0.03, 0, 0.95);
    const yPct = clamp(legendConfig?.yPct ?? 0.03, 0, 0.95);
    const widthPct = clamp(legendConfig?.widthPct ?? 0.26, 0.1, 0.95);
    const scale = clamp(legendConfig?.scale ?? 1, 0.5, 3);
    const layout = legendConfig?.layout === "row" ? "row" : "column";
    const title = legendConfig?.title
      ?? (mode === "zoning"
        ? "Zoning Districts"
        : mode === "permits"
          ? "Residential Permits 2014-2024"
          : (buildType?.label ?? "Build Overlay"));
    return {
      enabled,
      xPct,
      yPct,
      widthPct,
      scale,
      layout,
      title,
      items: legendConfig?.items ?? defaultLegendItems,
      backgroundColor: legendConfig?.backgroundColor ?? "rgba(255,255,255,0.94)",
      borderColor: legendConfig?.borderColor ?? "rgba(17,24,39,0.16)",
      textColor: legendConfig?.textColor ?? "#1f2937",
    };
  }, [buildType?.label, defaultLegendItems, legendConfig, mode]);
  const isSingleLineLegend = legend.layout === "row";
  const showPermitSizeLegend = mode === "permits";
  const permitLegendSizeScale = clamp(styleOverrides?.permitSizeScale ?? 1, 0.25, 4);
  const permitSmallRadiusPx = clamp(3.5 * permitLegendSizeScale, 2, 12);
  const permitLargeRadiusPx = clamp(17 * permitLegendSizeScale, 8, 34);

  useEffect(() => {
    (window as { __MAP_EXPORT_READY?: boolean }).__MAP_EXPORT_READY = false;
    document.body.dataset.mapExportReady = "false";
  }, [mode, buildTypeId, borderRatio, labelBoost]);

  const setReady = useCallback(() => {
    (window as { __MAP_EXPORT_READY?: boolean }).__MAP_EXPORT_READY = true;
    document.body.dataset.mapExportReady = "true";
  }, []);

  const waitForExpectedLayers = useCallback((map: MapLibreMap, attempt = 0) => {
    const zoningReady = Boolean(map.getLayer("zoning-fill"));
    const permitLayerReady = Boolean(map.getLayer("residential-permits-circles"));
    let permitFeatureCount = 0;
    let renderedPermitCount = 0;

    if (mode === "permits") {
      try {
        permitFeatureCount = map.querySourceFeatures("residential-permits").length;
      } catch {
        permitFeatureCount = 0;
      }
      if (permitLayerReady) {
        try {
          renderedPermitCount = map.queryRenderedFeatures({ layers: ["residential-permits-circles"] }).length;
        } catch {
          renderedPermitCount = 0;
        }
      }
    }

    const readyForMode = mode === "permits"
      ? permitLayerReady && permitFeatureCount > 0 && renderedPermitCount > 0
      : zoningReady;

    if (readyForMode || attempt >= 80) {
      setReady();
      return;
    }

    window.setTimeout(() => waitForExpectedLayers(map, attempt + 1), 150);
  }, [mode, setReady]);

  const handleMapIdle = useCallback((map: MapLibreMap) => {
    waitForExpectedLayers(map, 0);
  }, [waitForExpectedLayers]);

  if (!data) {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    <div id="print-map-root" className="relative h-full w-full">
      <ZoningMap
        data={data}
        activeCodes={activeCodes}
        activeBuild={mode === "build" ? buildType : null}
        permitsData={permitsData}
        showPermits={mode === "permits"}
        permitRenderMode="points"
        permitYearRange={null}
        selectedId={null}
        onSelectFeature={() => undefined}
        onSelectPermit={() => undefined}
        searchPin={null}
        fitPaddingRatio={borderRatio}
        fitBoundsCollections={[data, permitsData]}
        majorRoadLabelZoomReduction={labelBoost}
        interactive={false}
        showOverlayUi={false}
        onMapIdle={handleMapIdle}
        styleOverrides={styleOverrides}
      />

      {legend.enabled && legend.items.length > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: isSingleLineLegend ? "50%" : `${legend.xPct * 100}%`,
            top: `${legend.yPct * 100}%`,
            transform: isSingleLineLegend ? "translateX(-50%)" : undefined,
            width: isSingleLineLegend ? "fit-content" : `${legend.widthPct * 100}%`,
            maxWidth: isSingleLineLegend ? "95%" : undefined,
          }}
        >
          <div
            style={{
              background: legend.backgroundColor,
              border: `1px solid ${legend.borderColor}`,
              borderRadius: `${10 * legend.scale}px`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
              padding: isSingleLineLegend
                ? `${6 * legend.scale}px ${10 * legend.scale}px`
                : `${10 * legend.scale}px ${12 * legend.scale}px`,
              color: legend.textColor,
            }}
          >
            {isSingleLineLegend ? (
              <>
                <div className="flex flex-row flex-nowrap items-center justify-center" style={{ gap: `${4 * legend.scale}px ${12 * legend.scale}px` }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: `${13 * legend.scale}px`,
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {legend.title}
                  </div>
                  {legend.items.map((item) => (
                    <div key={`${item.label}-${item.color}`} className="flex items-center" style={{ gap: `${6 * legend.scale}px` }}>
                      <div
                        style={{
                          width: `${13 * legend.scale}px`,
                          height: `${13 * legend.scale}px`,
                          borderRadius: item.shape === "circle" ? "9999px" : `${3 * legend.scale}px`,
                          border: "1px solid rgba(17,24,39,0.2)",
                          background: item.color,
                          position: "relative",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {item.hatch && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background:
                                "repeating-linear-gradient(-45deg, rgba(17,24,39,0.24), rgba(17,24,39,0.24) 1px, transparent 1px, transparent 5px)",
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: `${12 * legend.scale}px`, lineHeight: 1.1, whiteSpace: "nowrap" }}>{item.label}</span>
                    </div>
                  ))}
                  {showPermitSizeLegend && (
                    <>
                      <div className="flex items-center" style={{ gap: `${6 * legend.scale}px` }}>
                        <div
                          style={{
                            width: `${permitSmallRadiusPx * 2}px`,
                            height: `${permitSmallRadiusPx * 2}px`,
                            borderRadius: "9999px",
                            border: "1px solid rgba(255,255,255,0.95)",
                            background: "rgba(100,116,139,0.72)",
                          }}
                        />
                        <span style={{ fontSize: `${11 * legend.scale}px`, whiteSpace: "nowrap" }}>1 unit</span>
                      </div>
                      <div className="flex items-center" style={{ gap: `${6 * legend.scale}px` }}>
                        <div
                          style={{
                            width: `${permitLargeRadiusPx * 2}px`,
                            height: `${permitLargeRadiusPx * 2}px`,
                            borderRadius: "9999px",
                            border: "1px solid rgba(255,255,255,0.95)",
                            background: "rgba(100,116,139,0.72)",
                          }}
                        />
                        <span style={{ fontSize: `${11 * legend.scale}px`, whiteSpace: "nowrap" }}>100 units</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: `${13 * legend.scale}px`,
                    marginBottom: `${8 * legend.scale}px`,
                    lineHeight: 1.25,
                  }}
                >
                  {legend.title}
                </div>
                <div
                  className="flex flex-col"
                  style={{ gap: `${6 * legend.scale}px` }}
                >
                  {legend.items.map((item) => (
                    <div key={`${item.label}-${item.color}`} className="flex items-center" style={{ gap: `${8 * legend.scale}px` }}>
                      <div
                        style={{
                          width: `${14 * legend.scale}px`,
                          height: `${14 * legend.scale}px`,
                          borderRadius: item.shape === "circle" ? "9999px" : `${3 * legend.scale}px`,
                          border: "1px solid rgba(17,24,39,0.2)",
                          background: item.color,
                          position: "relative",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {item.hatch && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background:
                                "repeating-linear-gradient(-45deg, rgba(17,24,39,0.24), rgba(17,24,39,0.24) 1px, transparent 1px, transparent 5px)",
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: `${12 * legend.scale}px`, lineHeight: 1.2 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                {showPermitSizeLegend && (
                  <div
                    className="mt-2 flex flex-row flex-nowrap items-center"
                    style={{
                      gap: `${5 * legend.scale}px ${12 * legend.scale}px`,
                      borderTop: "1px solid rgba(148,163,184,0.35)",
                      paddingTop: `${6 * legend.scale}px`,
                    }}
                  >
                    <div className="flex items-center" style={{ gap: `${6 * legend.scale}px` }}>
                      <div
                        style={{
                          width: `${permitSmallRadiusPx * 2}px`,
                          height: `${permitSmallRadiusPx * 2}px`,
                          borderRadius: "9999px",
                          border: "1px solid rgba(255,255,255,0.95)",
                          background: "rgba(100,116,139,0.72)",
                        }}
                      />
                      <span style={{ fontSize: `${11 * legend.scale}px`, whiteSpace: "nowrap" }}>1 unit</span>
                    </div>
                    <div className="flex items-center" style={{ gap: `${6 * legend.scale}px` }}>
                      <div
                        style={{
                          width: `${permitLargeRadiusPx * 2}px`,
                          height: `${permitLargeRadiusPx * 2}px`,
                          borderRadius: "9999px",
                          border: "1px solid rgba(255,255,255,0.95)",
                          background: "rgba(100,116,139,0.72)",
                        }}
                      />
                      <span style={{ fontSize: `${11 * legend.scale}px`, whiteSpace: "nowrap" }}>100 units</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
