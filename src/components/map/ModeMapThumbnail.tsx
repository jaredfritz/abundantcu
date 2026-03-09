"use client";

import { useMemo } from "react";
import Map, { Layer, Source, ViewState } from "react-map-gl/maplibre";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from "maplibre-gl";
import { BUILD_COLORS, BUILD_TYPES } from "@/lib/buildTypes";
import { ZONE_COLOR_MAP } from "@/lib/zoning";

const TILE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DEFAULT_BUILD = BUILD_TYPES.find((bt) => bt.id === "duplex") ?? BUILD_TYPES[0];

export type ModeThumbnailVariant = "zoning" | "permits" | "build";

interface ModeMapThumbnailProps {
  variant: ModeThumbnailVariant;
  data: GeoJSON.FeatureCollection;
  permitsData: GeoJSON.FeatureCollection;
  className?: string;
  initialViewState?: Partial<ViewState>;
}

function buildZoningFillExpr(): DataDrivenPropertyValueSpecification<string> {
  const arms: string[] = [];
  for (const [code, color] of Object.entries(ZONE_COLOR_MAP)) {
    arms.push(code, color);
  }
  return ["match", ["get", "zoning_code"], ...arms, "#d2d8df"] as unknown as DataDrivenPropertyValueSpecification<string>;
}

function buildBuildFillExpr(): DataDrivenPropertyValueSpecification<string> {
  const arms: unknown[] = [];
  if (DEFAULT_BUILD.allowedCodes.length > 0) arms.push(DEFAULT_BUILD.allowedCodes, BUILD_COLORS.allowed);
  if (DEFAULT_BUILD.provisionalCodes && DEFAULT_BUILD.provisionalCodes.length > 0) {
    arms.push(DEFAULT_BUILD.provisionalCodes, BUILD_COLORS.provisional);
  }
  if (DEFAULT_BUILD.notAllowedCodes.length > 0) arms.push(DEFAULT_BUILD.notAllowedCodes, BUILD_COLORS.notAllowed);
  return ["match", ["get", "zoning_code"], ...arms, "#d1d5db"] as unknown as DataDrivenPropertyValueSpecification<string>;
}

function buildPermitColorExpr(): DataDrivenPropertyValueSpecification<string> {
  return [
    "match",
    ["get", "building_type"],
    "SF",
    "#1F6CB0",
    "MF",
    "#B9387A",
    "#64748b",
  ] as unknown as DataDrivenPropertyValueSpecification<string>;
}

function buildPermitRadiusExpr(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["to-number", ["get", "units"]], 1],
    1,
    2,
    10,
    5,
    50,
    10,
    150,
    16,
  ];
}

export default function ModeMapThumbnail({
  variant,
  data,
  permitsData,
  className,
  initialViewState,
}: ModeMapThumbnailProps) {
  const zoningFillExpr = useMemo(() => buildZoningFillExpr(), []);
  const buildFillExpr = useMemo(() => buildBuildFillExpr(), []);
  const permitColorExpr = useMemo(() => buildPermitColorExpr(), []);
  const permitRadiusExpr = useMemo(() => buildPermitRadiusExpr(), []);
  const visibleFilter = ["has", "zoning_code"] as unknown as FilterSpecification;

  const fillColor =
    variant === "build" ? buildFillExpr : variant === "zoning" ? zoningFillExpr : "#94a3b8";
  const fillOpacity = variant === "permits" ? 0.2 : 0.56;

  return (
    <div className={className}>
      <Map
        initialViewState={{
          longitude: -88.2434,
          latitude: 40.1164,
          zoom: 11.6,
          ...initialViewState,
        }}
        mapStyle={TILE_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactive={false}
        attributionControl={false}
        dragRotate={false}
        touchZoomRotate={false}
      >
        <Source id={`thumb-zoning-${variant}`} type="geojson" data={data}>
          <Layer
            id={`thumb-fill-${variant}`}
            type="fill"
            filter={visibleFilter}
            paint={{
              "fill-color": fillColor,
              "fill-opacity": fillOpacity,
            }}
          />
          <Layer
            id={`thumb-outline-${variant}`}
            type="line"
            filter={visibleFilter}
            paint={{
              "line-color": "#475569",
              "line-width": 0.45,
              "line-opacity": 0.45,
            }}
          />
        </Source>

        {variant === "permits" ? (
          <Source id={`thumb-permits-${variant}`} type="geojson" data={permitsData}>
            <Layer
              id={`thumb-permit-circles-${variant}`}
              type="circle"
              paint={{
                "circle-color": permitColorExpr,
                "circle-radius": permitRadiusExpr as unknown as DataDrivenPropertyValueSpecification<number>,
                "circle-opacity": 0.72,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 0.4,
              }}
            />
          </Source>
        ) : null}
      </Map>
    </div>
  );
}
