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
import type { Parcel, Parcels } from "@/lib/parcels";
import {
  areaFilter,
  colorExpression,
  CU_VIEW_STATE,
  heightExpression,
  MAX_ZOOM,
  metricConfig,
  MIN_ZOOM,
  NO_DATA_COLOR,
  PARCEL_BASEMAP,
  VACANT_OUTLINE_COLOR,
  VIEW_3D,
  type ParcelMetric,
} from "@/lib/parcelMapStyles";
import { ParcelPopup } from "./ParcelPopup";

interface ParcelMapProps {
  data: Parcels;
  metric: ParcelMetric;
  cities: string[] | null;
  bounds: [number, number, number, number] | null;
  is3D: boolean;
  showVacant: boolean;
}

const INTERACTIVE_LAYERS = ["parcels-fill", "parcels-extrusion"];

export function ParcelMap({ data, metric, cities, bounds, is3D, showVacant }: ParcelMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<{ parcel: Parcel; lngLat: [number, number] } | null>(null);
  const config = metricConfig(metric);
  const filter = useMemo(() => areaFilter(cities), [cities]);
  const color = useMemo(() => colorExpression(config), [config]);
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
        onLoad={() => setLoaded(true)}
        cursor="pointer"
      >
        <NavigationControl position="top-right" visualizePitch />
        <Source id="parcels" type="geojson" data={data.geojson} tolerance={0.25}>
          <Layer
            id="parcels-fill"
            type="fill"
            filter={filter as never}
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
            filter={filter as never}
            layout={{ visibility: is3D ? "visible" : "none" }}
            paint={{
              "fill-extrusion-color": color as never,
              "fill-extrusion-height": height as never,
              "fill-extrusion-opacity": 0.9,
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

      <div className="absolute bottom-8 left-3 max-w-[220px] rounded-[4px] bg-white/90 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-2 text-xs font-semibold">{config.label}</p>
        <div className="space-y-1">
          {[...config.bins].reverse().map((bin) => (
            <div key={bin.label} className="flex items-center gap-2">
              <span className="h-3 w-4 rounded-[2px]" style={{ backgroundColor: bin.color }} />
              <span className="text-xs text-slate-700">{bin.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="h-3 w-4 rounded-[2px]" style={{ backgroundColor: NO_DATA_COLOR }} />
            <span className="text-xs text-slate-700">{config.noDataLabel}</span>
          </div>
          {showVacant && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded-[2px] border-2" style={{ borderColor: VACANT_OUTLINE_COLOR }} />
              <span className="text-xs text-slate-700">Vacant land</span>
            </div>
          )}
        </div>
        {is3D && <p className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">Height = {config.heightField === "tpa" ? "tax" : "value"} per acre</p>}
      </div>
    </div>
  );
}
