"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Popup, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown } from "lucide-react";
import { BASEMAP_ATTRIBUTION, MAX_ZOOM, MIN_ZOOM, PARCEL_BASEMAP } from "@/lib/parcelMapStyles";
import {
  colorLabel,
  formatPickup,
  upcomingPickups,
  YARD_WASTE,
  zoneById,
  zoneFill,
  zoneTextColor,
  type YardWasteZone,
} from "@/lib/yardWaste";

interface YardWasteMapProps {
  /** The searched address, marked on the map */
  point: { lng: number; lat: number } | null;
  /** The zone to outline (the searched address's) */
  highlightZoneId: string | null;
  /** Today in Champaign, once known in the browser (null while rendering on the server) */
  today: string | null;
}

const FILL_COLOR = [
  "match",
  ["get", "id"],
  ...YARD_WASTE.zones.flatMap((zone) => [zone.id, zoneFill(zone.id)]),
  "#94a3b8",
];

function boundsOf(collection: GeoJSON.FeatureCollection): [number, number, number, number] {
  let [west, south, east, north] = [180, 90, -180, -90];
  const visit = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === "number") {
      const [x, y] = coords as number[];
      west = Math.min(west, x);
      east = Math.max(east, x);
      south = Math.min(south, y);
      north = Math.max(north, y);
    } else (coords as unknown[]).forEach(visit);
  };
  for (const feature of collection.features) {
    if (feature.geometry && "coordinates" in feature.geometry) visit(feature.geometry.coordinates);
  }
  return [west, south, east, north];
}

const ZONE_BOUNDS = boundsOf(YARD_WASTE.geojson);
const INITIAL_VIEW = {
  longitude: (ZONE_BOUNDS[0] + ZONE_BOUNDS[2]) / 2,
  latitude: (ZONE_BOUNDS[1] + ZONE_BOUNDS[3]) / 2,
  zoom: 11.4,
};

export function YardWasteMap({ point, highlightZoneId, today }: YardWasteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [popup, setPopup] = useState<{ zone: YardWasteZone; lngLat: [number, number] } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setLegendOpen(false);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (point) {
      mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 14.5, duration: 900 });
    } else {
      mapRef.current?.fitBounds(ZONE_BOUNDS, { padding: 24, duration: 0 });
    }
  }, [loaded, point]);

  useEffect(() => setPopup(null), [point]);

  const handleClick = (event: MapLayerMouseEvent) => {
    if (popup) {
      setPopup(null);
      return;
    }
    const zone = zoneById(String(event.features?.[0]?.properties?.id ?? ""));
    if (zone) setPopup({ zone, lngLat: [event.lngLat.lng, event.lngLat.lat] });
  };

  const highlightFilter = useMemo(() => ["==", ["get", "id"], highlightZoneId ?? ""], [highlightZoneId]);

  return (
    <div className="relative">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxPitch={0}
        dragRotate={false}
        style={{ width: "100%", height: "min(600px, 70vh)", minHeight: "420px", borderRadius: "4px" }}
        mapStyle={PARCEL_BASEMAP}
        attributionControl={BASEMAP_ATTRIBUTION}
        interactiveLayerIds={["zones-fill"]}
        onClick={handleClick}
        onLoad={() => setLoaded(true)}
        cursor="pointer"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="zones" type="geojson" data={YARD_WASTE.geojson}>
          <Layer
            id="zones-fill"
            type="fill"
            paint={{ "fill-color": FILL_COLOR as never, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 15, 0.3] as never }}
          />
          <Layer
            id="zones-outline"
            type="line"
            paint={{
              "line-color": "#ffffff",
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 15, 2],
            }}
          />
          <Layer
            id="zones-highlight"
            type="line"
            filter={highlightFilter as never}
            paint={{ "line-color": "#002147", "line-width": 3 }}
          />
        </Source>

        {YARD_WASTE.zones.map((zone) => (
          <Marker key={zone.id} longitude={zone.label[0]} latitude={zone.label[1]} anchor="center">
            <span
              className="pointer-events-none select-none whitespace-nowrap rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold shadow-sm"
              style={{ backgroundColor: zoneFill(zone.id), color: zoneTextColor(zone.id) }}
            >
              {zone.id}
              {zone.weekday && <span className="font-medium"> {zone.weekday.slice(0, 3)}</span>}
            </span>
          </Marker>
        ))}

        {point && (
          <Marker longitude={point.lng} latitude={point.lat} anchor="bottom">
            <svg width="26" height="34" viewBox="0 0 26 34" aria-label="Your address" role="img">
              <path
                d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0z"
                fill="#002147"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="13" cy="13" r="4.5" fill="#ffffff" />
            </svg>
          </Marker>
        )}

        {popup && (
          <Popup
            longitude={popup.lngLat[0]}
            latitude={popup.lngLat[1]}
            onClose={() => setPopup(null)}
            closeOnClick={false}
            className="parcel-popup"
            maxWidth="260px"
            offset={8}
          >
            <ZonePopup zone={popup.zone} today={today} />
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-8 left-3 max-w-[260px] rounded-[4px] bg-white/90 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          aria-controls="yard-waste-legend"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold">{legendOpen ? "Collection zones" : "Legend"}</span>
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${legendOpen ? "" : "rotate-180"}`}
          />
          <span className="sr-only">{legendOpen ? "Hide legend" : "Show legend"}</span>
        </button>
        {legendOpen && (
          <div id="yard-waste-legend" className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 pb-3">
            {(["orange", "blue"] as const).map((color) => (
              <div key={color} className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-600">{colorLabel(color)}</p>
                {YARD_WASTE.zones
                  .filter((zone) => zone.color === color)
                  .map((zone) => (
                    <div key={zone.id} className="flex items-center gap-1.5">
                      <span className="h-3 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: zoneFill(zone.id) }} />
                      <span className="text-xs text-slate-700">
                        {zone.id} {zone.weekday?.slice(0, 3)}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ZonePopup({ zone, today }: { zone: YardWasteZone; today: string | null }) {
  const upcoming = today ? upcomingPickups(zone, today) : zone.pickups;
  return (
    <div className="pr-4 text-sm">
      <p className="font-semibold">
        Zone {zone.id} · {colorLabel(zone.color)}
      </p>
      {zone.weekday && <p className="text-slate-600">{zone.weekday}s</p>}
      <ul className="mt-2 space-y-0.5">
        {zone.pickups.map((pickup) => {
          const past = today !== null && pickup.end < today;
          const next = today !== null && upcoming[0] === pickup;
          return (
            <li key={pickup.start} className={past ? "text-slate-400 line-through" : next ? "font-semibold" : ""}>
              {formatPickup(pickup)}
              {next && <span className="ml-1 text-xs font-normal text-slate-500">(next)</span>}
            </li>
          );
        })}
      </ul>
      {today && upcoming.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">The {YARD_WASTE.meta.label} collection is over.</p>
      )}
    </div>
  );
}
