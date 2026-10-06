// Loads the zoned parcel layer built by scripts/build-zoning-parcels.mjs: every county parcel in the
// City of Champaign's zoning map, tagged with the district that covers it.

import { landUseFor, type LandUse } from "./parcels";

export const ZONING_PARCEL_DATA_URL = "/data/zoning-parcels.json";

const SQ_FT_PER_ACRE = 43560;

interface ZoningParcelDataset {
  meta: ZoningParcelMeta;
  dict: { zone: string[]; useCode: string[] };
  cols: {
    pin: string[];
    address: string[];
    units: number[];
    condoDev: number[];
    useCode: number[];
    exempt: number[];
    area: number[];
    zone: number[];
    zoneShare: number[];
    zone2: number[];
    zone2Share: number[];
    geom: number[][][][];
  };
}

export interface ZoningParcelMeta {
  parcelSource: string;
  parcelSourceUrl: string;
  parcelsGeneratedAt: string;
  zoningSource: string;
  generatedAt: string;
  parcels: number;
  splitZoned: number;
}

export interface ZoningParcel {
  index: number;
  pin: string;
  address: string;
  units: number;
  /** A condo or townhome development whose area is reconstructed, not a surveyed parcel */
  condoDevelopment: boolean;
  useCode: string;
  landUse: LandUse;
  sqft: number;
  acres: number;
  /** The district covering most of the parcel */
  zone: string;
  /** Percent of the parcel in `zone` */
  zoneShare: number;
  /** The runner-up district, for parcels split between districts */
  secondaryZone: string | null;
  secondaryZoneShare: number;
}

export interface ZoningParcelFeatureProps {
  i: number;
  zoning_code: string;
}

export interface ZoningParcels {
  meta: ZoningParcelMeta;
  parcels: ZoningParcel[];
  geojson: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, ZoningParcelFeatureProps>;
}

function decodeRing(flat: number[]): GeoJSON.Position[] {
  const ring: GeoJSON.Position[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    ring.push([x / 1e5, y / 1e5]);
  }
  return ring;
}

function decode(data: ZoningParcelDataset): ZoningParcels {
  const { cols, dict } = data;
  const parcels: ZoningParcel[] = [];
  const features: GeoJSON.Feature<GeoJSON.MultiPolygon, ZoningParcelFeatureProps>[] = [];
  for (let i = 0; i < cols.pin.length; i += 1) {
    const useCode = dict.useCode[cols.useCode[i]];
    const zone = dict.zone[cols.zone[i]];
    parcels.push({
      index: i,
      pin: cols.pin[i],
      address: cols.address[i],
      units: cols.units[i],
      condoDevelopment: cols.condoDev[i] === 1,
      useCode,
      landUse: landUseFor(useCode, cols.exempt[i] === 1),
      sqft: cols.area[i],
      acres: cols.area[i] / SQ_FT_PER_ACRE,
      zone,
      zoneShare: cols.zoneShare[i],
      secondaryZone: cols.zone2[i] >= 0 ? dict.zone[cols.zone2[i]] : null,
      secondaryZoneShare: cols.zone2Share[i],
    });
    features.push({
      type: "Feature",
      id: i,
      properties: { i, zoning_code: zone },
      geometry: { type: "MultiPolygon", coordinates: cols.geom[i].map((rings) => rings.map(decodeRing)) },
    });
  }
  return { meta: data.meta, parcels, geojson: { type: "FeatureCollection", features } };
}

let zoningParcelsPromise: Promise<ZoningParcels> | null = null;

export function loadZoningParcels(): Promise<ZoningParcels> {
  if (!zoningParcelsPromise) {
    zoningParcelsPromise = fetch(ZONING_PARCEL_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load zoned parcels (${res.status})`);
        return res.json() as Promise<ZoningParcelDataset>;
      })
      .then(decode)
      .catch((error) => {
        zoningParcelsPromise = null;
        throw error;
      });
  }
  return zoningParcelsPromise;
}

/** The zoned parcel containing a point, if any. */
export function zoningParcelAt(data: ZoningParcels, lng: number, lat: number): ZoningParcel | null {
  for (const feature of data.geojson.features) {
    for (const polygon of feature.geometry.coordinates) {
      if (pointInRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(lng, lat, hole))) {
        return data.parcels[feature.properties.i];
      }
    }
  }
  return null;
}

function pointInRing(x: number, y: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
