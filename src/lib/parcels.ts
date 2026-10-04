// Loads and summarizes the countywide parcel dataset built by scripts/fetch-parcel-values.mjs.
// Methodology adapted from Strong Towns Chicago's value-per-acre map (MIT); see
// src/components/parcels/LICENSE-chicago-value-per-acre.txt.

import { VACANT_CLASS_TYPES, vacantTypeFor, type VacantType } from "./vacant";

export const PARCEL_DATA_URL = "/data/parcels/champaign-county-parcels.json";

// Illinois counties outside Cook assess property at one-third of market value, so market value
// is three times the equalized assessed value (EAV).
export const ASSESSMENT_RATIO = 1 / 3;
const SQ_FT_PER_ACRE = 43560;

interface ParcelDataset {
  meta: ParcelMeta;
  dict: {
    useCode: string[];
    city: string[];
    taxCode: string[];
    taxRate: (number | null)[];
    tif: (string | null)[];
  };
  cols: {
    pin: string[];
    address: string[];
    units: number[];
    /** 1 when the parcel is a reconstructed condo/townhome development (approximate area) */
    condoDev: number[];
    useCode: number[];
    city: number[];
    taxCode: number[];
    exempt: number[];
    eav: (number | null)[];
    land: number[];
    building: number[];
    area: number[];
    geom: number[][][][];
  };
}

export interface ParcelMeta {
  parcelSource: string;
  parcelSourceUrl: string;
  rateSource: string;
  rateSourceUrl: string;
  addressSource: string;
  addressSourceUrl: string;
  taxYear: number | null;
  generatedAt: string;
  parcels: number;
}

export interface Parcel {
  index: number;
  pin: string;
  address: string;
  units: number;
  /** A condo or townhome development whose area is reconstructed, not a surveyed parcel */
  condoDevelopment: boolean;
  useCode: string;
  landUse: LandUse;
  /** Set for vacant parcels: which kind of vacant land the assessor classes it as */
  vacantType: VacantType | null;
  city: string;
  taxCode: string;
  taxRate: number | null;
  tif: string | null;
  exempt: boolean;
  acres: number;
  /** Estimated market value (3 x EAV); null for exempt parcels or missing assessments */
  marketValue: number | null;
  /** Estimated tax before exemptions (EAV x tax code rate); null when either is unknown */
  tax: number | null;
  /** Land's share of assessed value, 0-1; null when the parcel has no assessed value */
  landShare: number | null;
  valuePerAcre: number | null;
  taxPerAcre: number | null;
}

export interface Parcels {
  meta: ParcelMeta;
  parcels: Parcel[];
  geojson: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, ParcelFeatureProps>;
  cities: { name: string; count: number }[];
}

export interface ParcelFeatureProps {
  i: number;
  city: string;
  use: LandUse;
  /** Vacant land type, set only on vacant parcels */
  vac?: VacantType;
  vpa?: number;
  land?: number;
}

// ---------------------------------------------------------------------------
// Land use groups (Champaign County property class codes)
// ---------------------------------------------------------------------------

export type LandUse =
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Vacant"
  | "Farm"
  | "Energy & mineral"
  | "Common areas"
  | "Exempt"
  | "Other";

export const LAND_USE_ORDER: LandUse[] = [
  "Residential",
  "Commercial",
  "Industrial",
  "Vacant",
  "Farm",
  "Energy & mineral",
  "Common areas",
  "Exempt",
  "Other",
];

export const PROPERTY_CLASSES: Record<string, string> = {
  "0000": "New parcel, unassessed",
  "0010": "Other land",
  "0011": "Farm homesite and dwelling",
  "0020": "Other land",
  "0021": "Farmland",
  "0025": "Commercial energy storage",
  "0026": "Solar energy",
  "0027": "Wind farm",
  "0028": "Conservation stewardship",
  "0029": "Wooded transition",
  "0030": "Vacant residential lot",
  "0031": "Residential common area",
  "0032": "Vacant residential land (10-30 acres)",
  "0040": "Improved residential",
  "0041": "Model home",
  "0043": "Low-income housing",
  "0050": "Vacant commercial lot",
  "0051": "Commercial common area",
  "0052": "Vacant commercial land (10-30 acres)",
  "0060": "Improved commercial",
  "0062": "Vacant commercial land (10-30 acres)",
  "0065": "Commercial with farm",
  "0070": "Commercial improvements",
  "0072": "Vacant commercial land (10-30 acres)",
  "0080": "Industrial",
  "0081": "Vacant industrial land",
  "0082": "Vacant industrial land (10-30 acres)",
  "0085": "Farm / industrial",
  "0090": "Tax exempt",
  "0091": "Permanent fallout",
  "0092": "University of Illinois",
  "0093": "Railroad drainage",
  "4500": "State-assessed railroad",
  "4600": "Pollution control",
  "5000": "Railroad",
  "7100": "Coal",
  "7101": "Developed coal",
  "7200": "Oil lease",
  "7300": "Limestone",
  "7400": "Sand and gravel",
  "7500": "Fluorspar",
  "7600": "Mineral",
  "8000": "Leasehold interest",
};

const VACANT_CLASSES = new Set(Object.keys(VACANT_CLASS_TYPES));

export function landUseFor(useCode: string, exempt: boolean): LandUse {
  if (exempt || ["0090", "0091", "0092", "0093"].includes(useCode)) return "Exempt";
  if (VACANT_CLASSES.has(useCode)) return "Vacant";
  if (["0040", "0041", "0043", "0011"].includes(useCode)) return "Residential";
  if (["0060", "0065", "0070"].includes(useCode)) return "Commercial";
  if (["0080", "0085"].includes(useCode)) return "Industrial";
  if (["0010", "0020", "0021", "0028", "0029"].includes(useCode)) return "Farm";
  if (["0031", "0051"].includes(useCode)) return "Common areas";
  if (["0025", "0026", "0027"].includes(useCode) || useCode.startsWith("7")) return "Energy & mineral";
  return "Other";
}

export function propertyClassLabel(useCode: string): string {
  if (!useCode) return "Unknown";
  return `${useCode} · ${PROPERTY_CLASSES[useCode] ?? "Other"}`;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

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

function decodeParcels(data: ParcelDataset): Parcels {
  const { cols, dict } = data;
  const parcels: Parcel[] = [];
  const features: GeoJSON.Feature<GeoJSON.MultiPolygon, ParcelFeatureProps>[] = [];
  const cityCounts = new Map<string, number>();

  for (let i = 0; i < cols.pin.length; i += 1) {
    const useCode = dict.useCode[cols.useCode[i]];
    const exempt = cols.exempt[i] === 1;
    const city = dict.city[cols.city[i]] || "Unincorporated";
    const taxRate = dict.taxRate[cols.taxCode[i]];
    const eav = cols.eav[i];
    const acres = cols.area[i] / SQ_FT_PER_ACRE;
    const hasValue = !exempt && eav !== null && eav > 0;
    const marketValue = hasValue ? eav / ASSESSMENT_RATIO : exempt ? null : eav === 0 ? 0 : null;
    const tax = hasValue && taxRate !== null ? (eav * taxRate) / 100 : marketValue === 0 ? 0 : null;
    const assessed = cols.land[i] + cols.building[i];
    const landShare = !exempt && assessed > 0 ? cols.land[i] / assessed : null;
    const valuePerAcre = marketValue !== null && acres > 0 ? marketValue / acres : null;
    const taxPerAcre = tax !== null && acres > 0 ? tax / acres : null;

    const parcel: Parcel = {
      index: i,
      pin: cols.pin[i],
      address: cols.address[i],
      units: cols.units[i],
      condoDevelopment: cols.condoDev?.[i] === 1,
      useCode,
      landUse: landUseFor(useCode, exempt),
      vacantType: exempt ? null : vacantTypeFor(useCode),
      city,
      taxCode: dict.taxCode[cols.taxCode[i]],
      taxRate,
      tif: dict.tif[cols.taxCode[i]],
      exempt,
      acres,
      marketValue,
      tax,
      landShare,
      valuePerAcre,
      taxPerAcre,
    };
    parcels.push(parcel);
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);

    // MapLibre's ["has", ...] treats a present-but-null property as present, so only set the
    // numeric properties when they have a value.
    const props: ParcelFeatureProps = { i, city, use: parcel.landUse };
    if (valuePerAcre !== null) props.vpa = valuePerAcre;
    if (landShare !== null) props.land = landShare;
    if (parcel.vacantType) props.vac = parcel.vacantType;
    features.push({
      type: "Feature",
      id: i,
      properties: props,
      geometry: { type: "MultiPolygon", coordinates: cols.geom[i].map((rings) => rings.map(decodeRing)) },
    });
  }

  const cities = [...cityCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { meta: data.meta, parcels, geojson: { type: "FeatureCollection", features }, cities };
}

let parcelsPromise: Promise<Parcels> | null = null;

export function loadParcels(): Promise<Parcels> {
  if (!parcelsPromise) {
    parcelsPromise = fetch(PARCEL_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load parcel data (${res.status})`);
        return res.json() as Promise<ParcelDataset>;
      })
      .then(decodeParcels)
      .catch((error) => {
        parcelsPromise = null;
        throw error;
      });
  }
  return parcelsPromise;
}

// ---------------------------------------------------------------------------
// Area filters
// ---------------------------------------------------------------------------

export const CU_METRO = "cu";
export const ALL_COUNTY = "county";
const CU_METRO_CITIES = ["Champaign", "Urbana", "Savoy"];

export function areaLabel(area: string): string {
  if (area === CU_METRO) return "Champaign, Urbana & Savoy";
  if (area === ALL_COUNTY) return "All of Champaign County";
  return area;
}

export function areaCities(area: string): string[] | null {
  if (area === CU_METRO) return CU_METRO_CITIES;
  if (area === ALL_COUNTY) return null;
  return [area];
}

export function inArea(parcel: Parcel, area: string): boolean {
  const cities = areaCities(area);
  return cities === null || cities.includes(parcel.city);
}

export function boundsOf(parcels: Parcels, area: string): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const parcel of parcels.parcels) {
    if (!inArea(parcel, area)) continue;
    for (const polygon of parcels.geojson.features[parcel.index].geometry.coordinates) {
      for (const [x, y] of polygon[0]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export interface LandUseSummary {
  landUse: LandUse;
  parcels: number;
  acres: number;
  value: number;
  tax: number;
}

export interface AreaSummary {
  parcels: number;
  acres: number;
  taxableAcres: number;
  value: number;
  tax: number;
  vacantParcels: number;
  vacantAcres: number;
  byLandUse: LandUseSummary[];
}

export function summarize(parcels: Parcel[]): AreaSummary {
  const groups = new Map<LandUse, LandUseSummary>();
  const summary: AreaSummary = {
    parcels: 0,
    acres: 0,
    taxableAcres: 0,
    value: 0,
    tax: 0,
    vacantParcels: 0,
    vacantAcres: 0,
    byLandUse: [],
  };
  for (const parcel of parcels) {
    summary.parcels += 1;
    summary.acres += parcel.acres;
    if (!parcel.exempt) summary.taxableAcres += parcel.acres;
    summary.value += parcel.marketValue ?? 0;
    summary.tax += parcel.tax ?? 0;
    if (parcel.landUse === "Vacant") {
      summary.vacantParcels += 1;
      summary.vacantAcres += parcel.acres;
    }
    const group = groups.get(parcel.landUse) ?? { landUse: parcel.landUse, parcels: 0, acres: 0, value: 0, tax: 0 };
    group.parcels += 1;
    group.acres += parcel.acres;
    group.value += parcel.marketValue ?? 0;
    group.tax += parcel.tax ?? 0;
    groups.set(parcel.landUse, group);
  }
  summary.byLandUse = LAND_USE_ORDER.map((landUse) => groups.get(landUse)).filter(
    (group): group is LandUseSummary => Boolean(group && group.parcels > 0),
  );
  return summary;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatMoney(value: number | null, { compact = false } = {}): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatAcres(acres: number): string {
  if (acres >= 100) return Math.round(acres).toLocaleString();
  if (acres >= 1) return acres.toFixed(1);
  return acres.toFixed(2);
}

export function titleCaseAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b([a-z])/g, (char) => char.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw)\b/g, (dir) => dir.toUpperCase());
}

// Opens the county's page for the same tax year as the values on the map.
export function countyParcelUrl(pin: string, taxYear: number | null): string {
  const year = taxYear ?? new Date().getFullYear() - 1;
  return `https://champaignil.devnetwedge.com/parcel/view/${pin}/${year}`;
}

export function formatPin(pin: string): string {
  return pin.length === 12 ? `${pin.slice(0, 2)}-${pin.slice(2, 4)}-${pin.slice(4, 6)}-${pin.slice(6, 9)}-${pin.slice(9)}` : pin;
}
