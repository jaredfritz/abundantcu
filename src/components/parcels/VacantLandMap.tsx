"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Popup, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown } from "lucide-react";
import type { Parcel, Parcels } from "@/lib/parcels";
import { areaFilter, CU_VIEW_STATE, MAX_ZOOM, MIN_ZOOM, PARCEL_BASEMAP } from "@/lib/parcelMapStyles";
import { OTHER_PARCEL_COLOR, VACANT_TYPES } from "@/lib/vacant";
import { ParcelPopup } from "./ParcelPopup";
import { PARCEL_POPUP_CLASS, useParcelSelection } from "./shared";

interface VacantLandMapProps {
  data: Parcels;
  cities: string[] | null;
  bounds: [number, number, number, number] | null;
  /** A parcel picked from the table: the map flies to it and opens its popup. `key` lets a repeat pick refire. */
  focus: { parcel: Parcel; key: number } | null;
}

const VACANT_COLOR = ["match", ["get", "vac"], ...VACANT_TYPES.flatMap((type) => [type.id, type.color]), "#000000"];

function parcelBounds(data: Parcels, parcel: Parcel): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of data.geojson.features[parcel.index].geometry.coordinates) {
    for (const [x, y] of polygon[0]) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return [minX, minY, maxX, maxY];
}

export function VacantLandMap({ data, cities, bounds, focus }: VacantLandMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const { selected, setSelected, handleClick } = useParcelSelection(data);
  const filter = useMemo(() => areaFilter(cities), [cities]);
  const vacantFilter = ["all", filter, ["has", "vac"]];
  const otherFilter = ["all", filter, ["!", ["has", "vac"]]];

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setLegendOpen(false);
  }, []);

  useEffect(() => {
    if (!loaded || !bounds) return;
    mapRef.current?.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 800 });
  }, [loaded, bounds]);

  useEffect(() => {
    if (!loaded || !focus) return;
    const box = parcelBounds(data, focus.parcel);
    mapRef.current?.fitBounds(box, { padding: 120, maxZoom: 17, duration: 900 });
    setSelected({ parcel: focus.parcel, lngLat: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] });
  }, [loaded, focus, data, setSelected]);

  const selectedFilter = ["==", ["get", "i"], selected?.parcel.index ?? -1];

  return (
    <div className="relative">
      <Map
        ref={mapRef}
        initialViewState={CU_VIEW_STATE}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxPitch={0}
        dragRotate={false}
        style={{ width: "100%", height: "640px", borderRadius: "4px" }}
        mapStyle={PARCEL_BASEMAP}
        interactiveLayerIds={["vacant-fill", "other-fill"]}
        onClick={handleClick}
        onLoad={() => setLoaded(true)}
        cursor="pointer"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="parcels" type="geojson" data={data.geojson} tolerance={0.25}>
          <Layer
            id="other-fill"
            type="fill"
            filter={otherFilter as never}
            paint={{ "fill-color": OTHER_PARCEL_COLOR, "fill-opacity": 0.55 }}
          />
          <Layer
            id="vacant-fill"
            type="fill"
            filter={vacantFilter as never}
            paint={{ "fill-color": VACANT_COLOR as never, "fill-opacity": 0.9 }}
          />
          <Layer
            id="vacant-outline"
            type="line"
            filter={vacantFilter as never}
            paint={{
              "line-color": VACANT_COLOR as never,
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.5],
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
            className={PARCEL_POPUP_CLASS}
            maxWidth="300px"
            offset={8}
          >
            <ParcelPopup parcel={selected.parcel} taxYear={data.meta.taxYear} />
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-8 left-3 max-w-[240px] rounded-[4px] bg-white/90 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          aria-controls="vacant-legend"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold">{legendOpen ? "Vacant land" : "Legend"}</span>
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${legendOpen ? "" : "rotate-180"}`}
          />
          <span className="sr-only">{legendOpen ? "Hide legend" : "Show legend"}</span>
        </button>
        {legendOpen && (
          <div id="vacant-legend" className="space-y-1 px-3 pb-3">
            {VACANT_TYPES.map((type) => (
              <div key={type.id} className="flex items-start gap-2">
                <span className="mt-0.5 h-3 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: type.color }} />
                <span className="text-xs text-slate-700">{type.label}</span>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: OTHER_PARCEL_COLOR }} />
              <span className="text-xs text-slate-700">All other parcels</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
