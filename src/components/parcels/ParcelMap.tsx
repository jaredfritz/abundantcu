"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown } from "lucide-react";
import type { Parcel, Parcels } from "@/lib/parcels";
import {
  areaFilter,
  binsFor,
  colorExpression,
  CU_VIEW_STATE,
  heightExpression,
  MAX_ZOOM,
  metricConfig,
  MIN_ZOOM,
  NO_DATA_PATTERN,
  NO_DATA_SWATCH,
  noDataHatchImage,
  PARCEL_BASEMAP,
  VACANT_OUTLINE_COLOR,
  VIEW_3D,
  type ColorScale,
  type ParcelMetric,
} from "@/lib/parcelMapStyles";
import { formatMoney } from "@/lib/parcels";
import { ParcelPopup } from "./ParcelPopup";

interface ParcelMapProps {
  data: Parcels;
  metric: ParcelMetric;
  scale: ColorScale;
  /** Area average of the metric (per taxable acre), used by the "vs. area average" scale */
  average: number | null;
  cities: string[] | null;
  bounds: [number, number, number, number] | null;
  is3D: boolean;
  showVacant: boolean;
}

const INTERACTIVE_LAYERS = ["parcels-fill", "parcels-extrusion", "parcels-no-data"];

export function ParcelMap({ data, metric, scale, average, cities, bounds, is3D, showVacant }: ParcelMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  // Start with the legend collapsed on phones, where it would cover much of the map.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setLegendOpen(false);
  }, []);
  const [selected, setSelected] = useState<{ parcel: Parcel; lngLat: [number, number] } | null>(null);
  const config = metricConfig(metric);
  const filter = useMemo(() => areaFilter(cities), [cities]);
  const bins = useMemo(() => binsFor(config, scale, average), [config, scale, average]);
  const isAverageScale = bins !== config.bins;
  const color = useMemo(() => colorExpression(config, bins), [config, bins]);
  const hasValue = ["has", config.field];
  const valueFilter = ["all", filter, hasValue];
  const noDataFilter = ["all", filter, ["!", hasValue]];
  const height = useMemo(() => heightExpression(config), [config]);

  // Camera moves are ignored until the map has loaded, so wait for it before fitting the area.
  useEffect(() => {
    if (!loaded || !bounds) return;
    mapRef.current?.fitBounds(bounds, { padding: 40, duration: 800, maxZoom: 15, ...(is3D ? VIEW_3D : {}) });
    // Only refit when the area changes, not when toggling 3D.
  }, [loaded, bounds]);

  // The area fit above already applies the 3D tilt on load; only animate later toggles, since an
  // easeTo would cancel that fit.
  const appliedIs3D = useRef(is3D);
  useEffect(() => {
    if (!loaded || appliedIs3D.current === is3D) return;
    appliedIs3D.current = is3D;
    mapRef.current?.easeTo(is3D ? VIEW_3D : { pitch: 0, bearing: 0 }, { duration: 800 });
  }, [loaded, is3D]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.i;
      setSelected(
        typeof index === "number" ? { parcel: data.parcels[index], lngLat: [event.lngLat.lng, event.lngLat.lat] } : null,
      );
    },
    [data],
  );

  const selectedFilter = ["==", ["get", "i"], selected?.parcel.index ?? -1];

  return (
    <div className="relative">
      <Map
        ref={mapRef}
        initialViewState={CU_VIEW_STATE}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxPitch={70}
        style={{ width: "100%", height: "640px", borderRadius: "4px" }}
        mapStyle={PARCEL_BASEMAP}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onClick={handleClick}
        onLoad={(event) => {
          if (!event.target.hasImage(NO_DATA_PATTERN)) event.target.addImage(NO_DATA_PATTERN, noDataHatchImage());
          setLoaded(true);
        }}
        cursor="pointer"
      >
        <NavigationControl position="top-right" visualizePitch />
        <Source id="parcels" type="geojson" data={data.geojson} tolerance={0.25}>
          {loaded && (
            <Layer
              id="parcels-no-data"
              type="fill"
              filter={noDataFilter as never}
              paint={{ "fill-pattern": NO_DATA_PATTERN, "fill-opacity": 0.8 }}
            />
          )}
          <Layer
            id="parcels-fill"
            type="fill"
            filter={valueFilter as never}
            layout={{ visibility: is3D ? "none" : "visible" }}
            paint={{ "fill-color": color as never, "fill-opacity": 0.85 }}
          />
          <Layer
            id="parcels-outline"
            type="line"
            filter={filter as never}
            minzoom={14}
            layout={{ visibility: is3D ? "none" : "visible" }}
            paint={{ "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.2, 17, 1] }}
          />
          <Layer
            id="parcels-extrusion"
            type="fill-extrusion"
            filter={valueFilter as never}
            layout={{ visibility: is3D ? "visible" : "none" }}
            paint={{
              "fill-extrusion-color": color as never,
              "fill-extrusion-height": height as never,
              // Fully opaque: MapLibre depth-sorts extrusions, so lower opacity only lets parcels behind show through.
              "fill-extrusion-opacity": 1,
            }}
          />
          <Layer
            id="parcels-vacant"
            type="line"
            filter={["all", filter, ["==", ["get", "use"], "Vacant"]] as never}
            layout={{ visibility: showVacant ? "visible" : "none" }}
            paint={{
              "line-color": VACANT_OUTLINE_COLOR,
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 15, 2.5],
            }}
          />
          <Layer
            id="parcels-selected"
            type="line"
            filter={selectedFilter as never}
            paint={{ "line-color": "#002147", "line-width": 3 }}
          />
        </Source>
        {selected && (
          <Popup
            longitude={selected.lngLat[0]}
            latitude={selected.lngLat[1]}
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="300px"
            offset={8}
          >
            <ParcelPopup parcel={selected.parcel} taxYear={data.meta.taxYear} />
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-8 left-3 max-w-[220px] rounded-[4px] bg-white/90 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          aria-controls="parcel-legend"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold">{legendOpen ? config.label : "Legend"}</span>
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${legendOpen ? "" : "rotate-180"}`}
          />
          <span className="sr-only">{legendOpen ? "Hide legend" : "Show legend"}</span>
        </button>
        {legendOpen && (
          <div id="parcel-legend" className="px-3 pb-3">
            {isAverageScale && average !== null && (
              <p className="-mt-1 text-[11px] text-slate-500">Area average: {formatMoney(average, { compact: true })}</p>
            )}
            <div className="mt-2 space-y-1">
              {[...bins].reverse().map((bin) => (
                <div key={bin.label} className="flex items-center gap-2">
                  <span className="h-3 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: bin.color }} />
                  <span className="text-xs text-slate-700">{bin.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="h-3 w-4 shrink-0 rounded-[2px]" style={{ background: NO_DATA_SWATCH }} />
                <span className="text-xs text-slate-700">{config.noDataLabel}</span>
              </div>
              {showVacant && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-[2px] border-2" style={{ borderColor: VACANT_OUTLINE_COLOR }} />
                  <span className="text-xs text-slate-700">Vacant land</span>
                </div>
              )}
            </div>
            {is3D && (
              <p className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
                Height = {config.heightField === "tpa" ? "tax" : "value"} per acre
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
