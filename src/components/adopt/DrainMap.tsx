"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import type { DrainRow } from "@/lib/adoptADrain";
import { BASEMAP_ATTRIBUTION, PARCEL_BASEMAP } from "@/lib/parcelMapStyles";

/**
 * Drains differ by fill and lightness, not hue alone: available is solid blue, adopted is a hollow gray ring, and
 * yours is orange. Blue and orange stay distinct for the common kinds of color blindness.
 */
export const DRAIN_COLORS = {
  available: { fill: "#0072b2", stroke: "#ffffff" },
  adopted: { fill: "#ffffff", stroke: "#6b7280" },
  mine: { fill: "#e69f00", stroke: "#002147" },
};

export type DrainFilter = "all" | "available" | "adopted";

/** Champaign, where the City's drains are */
const CHAMPAIGN_VIEW = { longitude: -88.26, latitude: 40.11, zoom: 12.3, pitch: 0, bearing: 0 };

interface DrainMapProps {
  drains: DrainRow[];
  mine: Set<number>;
  filter: DrainFilter;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** Fly here when it changes; `key` lets a repeat request refire. */
  flyTo: { lng: number; lat: number; zoom?: number; key: number } | null;
}

type DrainProps = { id: number; s: 0 | 1 | 2 };

export default function DrainMap({ drains, mine, filter, selectedId, onSelect, flyTo }: DrainMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState("");

  const data = useMemo<FeatureCollection<Point, DrainProps>>(
    () => ({
      type: "FeatureCollection",
      features: drains.map(([id, lng, lat, adopted]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { id, s: mine.has(id) ? 2 : adopted ? 1 : 0 },
      })),
    }),
    [drains, mine]
  );

  useEffect(() => {
    if (!loaded || !flyTo) return;
    mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 17, duration: 900 });
  }, [loaded, flyTo]);

  function handleClick(event: MapLayerMouseEvent) {
    const map = mapRef.current;
    if (!map) return;
    // Drains are small dots, so pick the nearest one within a finger's width of the click.
    const { x, y } = event.point;
    const hits = map.queryRenderedFeatures(
      [
        [x - 14, y - 14],
        [x + 14, y + 14],
      ],
      { layers: ["drains"] }
    );
    if (!hits.length) {
      onSelect(null);
      return;
    }
    let best = hits[0];
    let bestDistance = Infinity;
    for (const hit of hits) {
      if (hit.geometry.type !== "Point") continue;
      const projected = map.project(hit.geometry.coordinates as [number, number]);
      const distance = (projected.x - x) ** 2 + (projected.y - y) ** 2;
      if (distance < bestDistance) {
        best = hit;
        bestDistance = distance;
      }
    }
    onSelect(Number(best.properties?.id));
  }

  const radius = ["interpolate", ["linear"], ["zoom"], 11, 2.4, 14, 5, 16, 8.5, 18, 12.5];
  const layerFilter =
    filter === "available" ? ["==", ["get", "s"], 0] : filter === "adopted" ? [">", ["get", "s"], 0] : ["has", "s"];
  const byStatus = (available: string, adopted: string, mineValue: string) =>
    ["match", ["get", "s"], 2, mineValue, 1, adopted, available] as never;

  return (
    <Map
      ref={mapRef}
      initialViewState={CHAMPAIGN_VIEW}
      minZoom={10}
      maxZoom={19}
      maxPitch={0}
      dragRotate={false}
      style={{ width: "100%", height: "100%" }}
      mapStyle={PARCEL_BASEMAP}
      attributionControl={BASEMAP_ATTRIBUTION}
      cursor={cursor}
      onLoad={() => setLoaded(true)}
      onClick={handleClick}
      onMouseMove={(event) => {
        const map = mapRef.current;
        if (!map) return;
        const { x, y } = event.point;
        const hits = map.queryRenderedFeatures(
          [
            [x - 8, y - 8],
            [x + 8, y + 8],
          ],
          { layers: ["drains"] }
        );
        setCursor(hits.length ? "pointer" : "");
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <Source id="drains" type="geojson" data={data}>
        <Layer
          id="drains"
          type="circle"
          filter={layerFilter as never}
          paint={{
            "circle-radius": radius as never,
            "circle-color": byStatus(DRAIN_COLORS.available.fill, DRAIN_COLORS.adopted.fill, DRAIN_COLORS.mine.fill),
            "circle-stroke-color": byStatus(
              DRAIN_COLORS.available.stroke,
              DRAIN_COLORS.adopted.stroke,
              DRAIN_COLORS.mine.stroke
            ),
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 1.5, 17, 2.5] as never,
          }}
          layout={{ "circle-sort-key": ["get", "s"] as never }}
        />
        <Layer
          id="drain-selected"
          type="circle"
          filter={["==", ["get", "id"], selectedId ?? -1]}
          paint={{
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 14, 18, 19] as never,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#002147",
            "circle-stroke-width": 3,
          }}
        />
      </Source>
    </Map>
  );
}
