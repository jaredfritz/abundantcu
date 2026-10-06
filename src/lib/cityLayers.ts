// City of Champaign zoning and boundary layers for /data/city-map, built by
// scripts/fetch-city-layers.mjs (one GeoJSON file per layer, loaded when the layer is first needed).

import { getZoneDescription, ZONE_COLOR_MAP } from "./zoning";

export const CITY_LAYER_DIR = "/data/city-layers";
export const OPEN_DATA_SITE = "https://gis-cityofchampaign.opendata.arcgis.com/";

export type CityLayerGroup = "zoning" | "boundaries";

export const CITY_LAYER_GROUPS: { id: CityLayerGroup; label: string }[] = [
  { id: "zoning", label: "Zoning" },
  { id: "boundaries", label: "Boundaries & districts" },
];

type Props = Record<string, string | number | undefined>;

/** How a feature reads in the "At this location" panel. */
export interface FeatureSummary {
  value: string;
  detail?: string;
  link?: { href: string; label: string };
}

export interface CityLayer {
  id: string;
  label: string;
  /** Heading for this layer's entry in the "At this location" panel */
  itemLabel: string;
  group: CityLayerGroup;
  /** One line under the layer name in the layer list */
  description: string;
  /** "area" layers are drawn as filled shapes, "boundary" layers as outlines with labels */
  style: "area" | "boundary" | "point";
  color: string;
  /** MapLibre expression for the label drawn on the map, if any */
  mapLabel?: unknown[];
  /** Name for the "Not in ..." line when a spot falls outside every shape (layers that don't cover the city) */
  notIn?: string;
  summarize: (props: Props) => FeatureSummary;
}

const str = (value: string | number | undefined) => (value === undefined ? "" : String(value));
const joined = (...parts: (string | number | undefined)[]) => parts.map(str).filter(Boolean).join(" · ");
const docLink = (props: Props, label = "City documents") =>
  props.link ? { href: str(props.link), label } : undefined;

const NEIGHBORHOOD_TYPES: Record<string, string> = {
  HOA: "Homeowners association",
  NA: "Neighborhood association",
  NW: "Neighborhood watch",
};

export const CITY_LAYERS: CityLayer[] = [
  {
    id: "zoning",
    itemLabel: "Zoning",
    label: "Zoning districts",
    group: "zoning",
    description: "The base zoning for every lot in the city",
    style: "area",
    color: "#93c5fd",
    mapLabel: ["get", "code"],
    summarize: (props) => ({ value: str(props.code), detail: getZoneDescription(str(props.code)) }),
  },
  {
    id: "planned-developments",
    itemLabel: "Planned development",
    label: "Planned developments",
    group: "zoning",
    description: "Sites with custom rules approved as one project",
    style: "area",
    color: "#9333ea",
    notIn: "a planned development",
    summarize: (props) => ({
      value: str(props.name) || "Planned development",
      detail: joined(props.address, props.status, props.case),
      link: docLink(props),
    }),
  },
  {
    id: "special-use-permits",
    itemLabel: "Special use permit",
    label: "Special use permits",
    group: "zoning",
    description: "Uses allowed case by case, beyond what the zone allows",
    style: "area",
    color: "#e11d48",
    notIn: "a special use permit",
    summarize: (props) => ({
      value: str(props.type) || "Special use permit",
      detail: joined(props.address, props.status, props.effective && `effective ${props.effective}`, props.case),
      link: docLink(props),
    }),
  },
  {
    id: "historic",
    itemLabel: "Historic landmark or district",
    label: "Historic landmarks & districts",
    group: "zoning",
    description: "Locally designated landmarks and historic districts",
    style: "area",
    color: "#92400e",
    notIn: "a historic landmark or district",
    summarize: (props) => ({
      value: str(props.name) || "Historic landmark",
      detail: joined(props.type, props.address, props.designated && `designated ${props.designated}`),
      link: docLink(props),
    }),
  },
  {
    id: "annexation-agreements",
    itemLabel: "Annexation agreement",
    label: "Annexation agreements",
    group: "zoning",
    description: "Land covered by an agreement to join the city",
    style: "area",
    color: "#475569",
    notIn: "an annexation agreement",
    summarize: (props) => ({
      value: str(props.name) || "Annexation agreement",
      detail: joined(props.status, props.zoning && `zoning: ${props.zoning}`, props.bill),
      link: docLink(props, "Agreement"),
    }),
  },
  {
    id: "mitigation-plans",
    itemLabel: "Mitigation plan",
    label: "Mitigation plans",
    group: "zoning",
    description: "Nonconforming businesses operating under a mitigation plan",
    style: "area",
    color: "#0f766e",
    notIn: "a mitigation plan",
    summarize: (props) => ({
      value: str(props.name) || "Mitigation plan",
      detail: joined(props.status, props.case),
      link: docLink(props),
    }),
  },
  {
    id: "council-districts",
    itemLabel: "City council district",
    label: "City council districts",
    group: "boundaries",
    description: "Five districts, each electing one council member",
    style: "boundary",
    color: "#7c3aed",
    mapLabel: ["concat", "District ", ["get", "district"]],
    summarize: (props) => ({ value: `District ${str(props.district)}`, detail: str(props.member) }),
  },
  {
    id: "police-districts",
    itemLabel: "Police district",
    label: "Police districts",
    group: "boundaries",
    description: "The police department's four patrol districts",
    style: "boundary",
    color: "#1d4ed8",
    mapLabel: ["get", "district"],
    summarize: (props) => ({ value: str(props.district), detail: str(props.area) }),
  },
  {
    id: "police-beats",
    itemLabel: "Police beat",
    label: "Police beats",
    group: "boundaries",
    description: "Patrol beats within each district",
    style: "boundary",
    color: "#0891b2",
    mapLabel: ["concat", "Beat ", ["get", "beat"]],
    summarize: (props) => ({ value: `Beat ${str(props.beat)}` }),
  },
  {
    id: "planning-areas",
    itemLabel: "Planning area",
    label: "Planning areas",
    group: "boundaries",
    description: "Areas the city uses for neighborhood planning",
    style: "boundary",
    color: "#65a30d",
    mapLabel: ["get", "name"],
    summarize: (props) => ({ value: str(props.name) }),
  },
  {
    id: "neighborhood-orgs",
    itemLabel: "Neighborhood organization",
    label: "Neighborhood organizations",
    group: "boundaries",
    description: "Registered neighborhood groups and HOAs",
    style: "area",
    color: "#db2777",
    mapLabel: ["get", "name"],
    notIn: "a registered neighborhood organization",
    summarize: (props) => ({
      value: str(props.name),
      detail: NEIGHBORHOOD_TYPES[str(props.type)] ?? str(props.type),
    }),
  },
  {
    id: "tif-districts",
    itemLabel: "TIF district",
    label: "TIF districts",
    group: "boundaries",
    description: "Tax increment financing districts",
    style: "area",
    color: "#ea580c",
    mapLabel: ["get", "name"],
    notIn: "a TIF district",
    summarize: (props) => ({ value: str(props.name) }),
  },
  {
    id: "enterprise-zone",
    itemLabel: "Enterprise zone",
    label: "Enterprise zone",
    group: "boundaries",
    description: "State tax incentives for business investment",
    style: "area",
    color: "#ca8a04",
    notIn: "the enterprise zone",
    summarize: (props) => ({ value: str(props.name), detail: props.expires ? `Expires ${props.expires}` : undefined }),
  },
  {
    id: "special-service-areas",
    itemLabel: "Special service area",
    label: "Special service areas",
    group: "boundaries",
    description: "Areas paying an added tax for extra services",
    style: "area",
    color: "#0d9488",
    mapLabel: ["get", "name"],
    notIn: "a special service area",
    summarize: (props) => ({ value: str(props.name) }),
  },
  {
    id: "fire-stations",
    itemLabel: "Nearest fire station",
    label: "Fire stations",
    group: "boundaries",
    description: "The city's six fire stations",
    style: "point",
    color: "#dc2626",
    mapLabel: ["concat", "Station ", ["to-string", ["get", "station"]]],
    summarize: (props) => ({ value: str(props.name) }),
  },
];

export const CITY_LAYER_IDS = CITY_LAYERS.map((layer) => layer.id);

export function cityLayer(id: string): CityLayer | undefined {
  return CITY_LAYERS.find((layer) => layer.id === id);
}

/** Fill color for zoning districts, by code, matching /data/zoning. */
export const ZONING_FILL: unknown[] = [
  "match",
  ["get", "code"],
  ...Object.entries(ZONE_COLOR_MAP).flat(),
  "#d4d4d4",
];

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export type CityLayerData = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point, Props>;

const cache = new Map<string, Promise<CityLayerData>>();

export function loadCityLayer(id: string): Promise<CityLayerData> {
  let promise = cache.get(id);
  if (!promise) {
    promise = fetch(`${CITY_LAYER_DIR}/${id}.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${id} (${res.status}). Build it with \`npm run data:city-layers\`.`);
        return res.json() as Promise<CityLayerData>;
      })
      .catch((error) => {
        cache.delete(id);
        throw error;
      });
    cache.set(id, promise);
  }
  return promise;
}

// ---------------------------------------------------------------------------
// What's at a point
// ---------------------------------------------------------------------------

function pointInRing(x: number, y: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(x: number, y: number, polygon: GeoJSON.Position[][]): boolean {
  return pointInRing(x, y, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(x, y, hole));
}

function containsPoint(geometry: GeoJSON.Geometry, x: number, y: number): boolean {
  if (geometry.type === "Polygon") return pointInPolygon(x, y, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => pointInPolygon(x, y, polygon));
  return false;
}

/** Straight-line distance in miles. */
function milesBetween([lng1, lat1]: GeoJSON.Position, [lng2, lat2]: GeoJSON.Position): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export interface LayerMatch {
  layer: CityLayer;
  features: FeatureSummary[];
}

/**
 * Every feature of each layer at a point. Point layers (fire stations) report the nearest feature
 * and its distance instead.
 */
export function layersAt(layers: { layer: CityLayer; data: CityLayerData }[], lng: number, lat: number): LayerMatch[] {
  return layers.map(({ layer, data }) => {
    if (layer.style === "point") {
      let nearest: { props: Props; miles: number } | null = null;
      for (const feature of data.features) {
        if (feature.geometry.type !== "Point") continue;
        const miles = milesBetween([lng, lat], feature.geometry.coordinates);
        if (!nearest || miles < nearest.miles) nearest = { props: feature.properties, miles };
      }
      return {
        layer,
        features: nearest
          ? [{ ...layer.summarize(nearest.props), detail: `${nearest.miles.toFixed(1)} miles away in a straight line` }]
          : [],
      };
    }
    const features = data.features
      .filter((feature) => containsPoint(feature.geometry, lng, lat))
      .map((feature) => layer.summarize(feature.properties));
    return { layer, features };
  });
}
