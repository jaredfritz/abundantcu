"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Parcel, Parcels } from "@/lib/parcels";
import { boundsOfParcel } from "@/lib/parcels";
import { BASEMAP_ATTRIBUTION, colorExpression, MAX_ZOOM, metricConfig, MIN_ZOOM, PARCEL_BASEMAP } from "@/lib/parcelMapStyles";
import { CITY_LAYERS, ZONING_FILL, type CityLayer, type CityLayerData } from "@/lib/cityLayers";

export type ParcelStyle = "outline" | "value" | "off";

export interface Spot {
  lng: number;
  lat: number;
  /** Set when the spot came from a search, so the map zooms to that parcel */
  parcel?: Parcel;
  key: number;
}

interface CityMapProps {
  parcels: Parcels | null;
  parcelStyle: ParcelStyle;
  active: Set<string>;
  layerData: Record<string, CityLayerData>;
  spot: Spot | null;
  /** The parcel at the spot, outlined on the map */
  selectedParcel: Parcel | null;
  onPick: (lng: number, lat: number) => void;
  /** The "At this location" panel, drawn over the map */
  children?: ReactNode;
}

// Downtown Champaign, zoomed to show most of the city.
const CHAMPAIGN_VIEW = { longitude: -88.27, latitude: 40.11, zoom: 12, pitch: 0, bearing: 0 };
const LABEL_FONT = ["Montserrat Medium", "Open Sans Bold", "Noto Sans Regular"];
const EMPTY: CityLayerData = { type: "FeatureCollection", features: [] };
const VALUE_COLOR = colorExpression(metricConfig("value"));
// Parcels draw under every city layer; this is the lowest one.
const FIRST_CITY_LAYER = `${CITY_LAYERS[0].id}-fill`;

export function CityMap({ parcels, parcelStyle, active, layerData, spot, selectedParcel, onPick, children }: CityMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !spot) return;
    const map = mapRef.current;
    if (!map) return;
    if (spot.parcel && parcels) {
      map.fitBounds(boundsOfParcel(parcels, spot.parcel), { padding: 120, maxZoom: 17, duration: 900 });
    } else if (map.getZoom() < 14) {
      map.easeTo({ center: [spot.lng, spot.lat], zoom: 14, duration: 700 });
    }
    // Only move the camera for a new spot, not when parcels finish loading.
  }, [loaded, spot]);

  const handleClick = (event: MapLayerMouseEvent) => onPick(event.lngLat.lng, event.lngLat.lat);
  const visibility = (on: boolean) => (on ? "visible" : "none");

  return (
    <div className="relative">
      <Map
        ref={mapRef}
        initialViewState={CHAMPAIGN_VIEW}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        style={{ width: "100%", height: "680px", borderRadius: "4px" }}
        mapStyle={PARCEL_BASEMAP}
        attributionControl={BASEMAP_ATTRIBUTION}
        onClick={handleClick}
        onLoad={() => setLoaded(true)}
        cursor="crosshair"
      >
        {/* Top left, where the "At this location" panel (top right on wide screens, bottom on phones) never covers it. */}
        <NavigationControl position="top-left" showCompass={false} />

        {/* Every city layer is always mounted (empty until loaded) so the drawing order stays fixed:
            areas, then boundary lines, then labels on top. */}
        {CITY_LAYERS.map((layer) => (
          <Source key={layer.id} id={layer.id} type="geojson" data={layerData[layer.id] ?? EMPTY}>
            <CityLayerShapes layer={layer} visible={active.has(layer.id)} />
          </Source>
        ))}
        {CITY_LAYERS.filter((layer) => layer.mapLabel).map((layer) => (
          <Layer
            key={`${layer.id}-label`}
            id={`${layer.id}-label`}
            source={layer.id}
            type="symbol"
            minzoom={layer.id === "zoning" ? 14 : layer.style === "point" ? 11 : 10}
            layout={{
              visibility: visibility(active.has(layer.id)),
              "text-field": layer.mapLabel as never,
              "text-font": LABEL_FONT,
              "text-size": layer.id === "zoning" ? 11 : 12,
              "text-max-width": 8,
              ...(layer.style === "point" ? { "text-offset": [0, 1.2], "text-anchor": "top" } : {}),
            }}
            paint={{
              "text-color": layer.id === "zoning" ? "#334155" : layer.color,
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            }}
          />
        ))}

        {parcels && (
          <Source id="parcels" type="geojson" data={parcels.geojson} tolerance={0.25}>
            <Layer
              id="parcels-value"
              type="fill"
              beforeId={FIRST_CITY_LAYER}
              layout={{ visibility: visibility(parcelStyle === "value") }}
              paint={{ "fill-color": VALUE_COLOR as never, "fill-opacity": 0.8 }}
            />
            <Layer
              id="parcels-outline"
              type="line"
              beforeId={FIRST_CITY_LAYER}
              minzoom={parcelStyle === "value" ? 14 : 13}
              layout={{ visibility: visibility(parcelStyle !== "off") }}
              paint={{
                "line-color": parcelStyle === "value" ? "#ffffff" : "#64748b",
                "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.2, 17, 1],
              }}
            />
            <Layer
              id="parcels-selected"
              type="line"
              filter={["==", ["get", "i"], selectedParcel?.index ?? -1]}
              paint={{ "line-color": "#002147", "line-width": 3 }}
            />
          </Source>
        )}

        {spot && (
          <Marker longitude={spot.lng} latitude={spot.lat} anchor="center">
            <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-[var(--color-primary)] shadow-md" />
          </Marker>
        )}
      </Map>
      {children}
    </div>
  );
}

// Source only passes its id to direct <Layer> children, so these name their source themselves.
function CityLayerShapes({ layer, visible }: { layer: CityLayer; visible: boolean }) {
  const layout = { visibility: visible ? "visible" : "none" } as const;
  if (layer.style === "point") {
    return (
      <Layer
        id={`${layer.id}-fill`}
        source={layer.id}
        type="circle"
        layout={layout}
        paint={{ "circle-radius": 6, "circle-color": layer.color, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 }}
      />
    );
  }
  const isZoning = layer.id === "zoning";
  return (
    <>
      <Layer
        id={`${layer.id}-fill`}
        source={layer.id}
        type="fill"
        layout={layout}
        paint={{
          "fill-color": (isZoning ? ZONING_FILL : layer.color) as never,
          // Boundaries are outlines only: a transparent fill keeps them from hiding the layers below.
          "fill-opacity": isZoning ? 0.55 : layer.style === "boundary" ? 0 : 0.22,
        }}
      />
      <Layer
        id={`${layer.id}-line`}
        source={layer.id}
        type="line"
        layout={layout}
        paint={{
          "line-color": isZoning ? "#ffffff" : layer.color,
          "line-width": isZoning ? 0.6 : layer.style === "boundary" ? 2.5 : 1.5,
          ...(layer.style === "boundary" ? { "line-dasharray": [3, 1.5] } : {}),
        }}
      />
    </>
  );
}
