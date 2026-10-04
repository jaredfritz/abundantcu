// Map styling for /data/value-per-acre. Breaks and extrusion heights are adapted from Strong Towns
// Chicago's scales.js and rescaled for Champaign County, where values run lower than Chicago's.

export const PARCEL_BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const CU_VIEW_STATE = { longitude: -88.235, latitude: 40.105, zoom: 12.2, pitch: 0, bearing: 0 };
export const VIEW_3D = { pitch: 55, bearing: -20 };

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 18;

export const NO_DATA_COLOR = "#d4d4d4";
export const VACANT_OUTLINE_COLOR = "#e34948";

export type ParcelMetric = "value" | "tax" | "land";

interface Bin {
  /** Upper bound (exclusive) of this bin; Infinity for the last bin */
  max: number;
  label: string;
  color: string;
}

export interface MetricConfig {
  id: ParcelMetric;
  label: string;
  /** Feature property holding the value */
  field: "vpa" | "tpa" | "land";
  description: string;
  bins: Bin[];
  noDataLabel: string;
  /** Property and [value, meters] stops for the 3D extrusion height */
  heightField: "vpa" | "tpa";
  heights: [number, number][];
}

const VALUE_HEIGHTS: [number, number][] = [
  [0, 0],
  [1_000_000, 30],
  [5_000_000, 150],
  [10_000_000, 300],
  [25_000_000, 600],
  [50_000_000, 1000],
  [200_000_000, 2000],
];

// Single-hue sequential ramps, light (low) to dark (high).
const BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const ORANGE = ["#fde3d3", "#f9c0a0", "#f39a6c", "#eb6834", "#c8521f", "#9c3e14"];

export const MAP_METRICS: MetricConfig[] = [
  {
    id: "value",
    label: "Value per acre",
    field: "vpa",
    description: "Estimated market value (3 × equalized assessed value) divided by parcel area.",
    noDataLabel: "Exempt or no assessment",
    bins: [
      { max: 100_000, label: "Under $100k", color: BLUE[0] },
      { max: 250_000, label: "$100k–$250k", color: BLUE[1] },
      { max: 500_000, label: "$250k–$500k", color: BLUE[2] },
      { max: 1_000_000, label: "$500k–$1M", color: BLUE[3] },
      { max: 2_000_000, label: "$1M–$2M", color: BLUE[4] },
      { max: 5_000_000, label: "$2M–$5M", color: BLUE[5] },
      { max: Infinity, label: "$5M and up", color: BLUE[6] },
    ],
    heightField: "vpa",
    heights: VALUE_HEIGHTS,
  },
  {
    id: "tax",
    label: "Property tax per acre",
    field: "tpa",
    description: "Estimated property tax before exemptions (EAV × tax code rate) divided by parcel area.",
    noDataLabel: "Exempt or rate unavailable",
    bins: [
      { max: 2_500, label: "Under $2.5k", color: BLUE[0] },
      { max: 6_000, label: "$2.5k–$6k", color: BLUE[1] },
      { max: 12_000, label: "$6k–$12k", color: BLUE[2] },
      { max: 25_000, label: "$12k–$25k", color: BLUE[3] },
      { max: 50_000, label: "$25k–$50k", color: BLUE[4] },
      { max: 125_000, label: "$50k–$125k", color: BLUE[5] },
      { max: Infinity, label: "$125k and up", color: BLUE[6] },
    ],
    heightField: "tpa",
    heights: [
      [0, 0],
      [25_000, 30],
      [125_000, 150],
      [250_000, 300],
      [625_000, 600],
      [1_250_000, 1000],
      [5_000_000, 2000],
    ],
  },
  {
    id: "land",
    label: "Land share of value",
    field: "land",
    description:
      "The share of a parcel's assessed value that is land rather than buildings. High shares mark land that is " +
      "vacant or lightly used for its location, like surface parking.",
    noDataLabel: "Exempt or no assessment",
    bins: [
      { max: 0.1, label: "Under 10%", color: ORANGE[0] },
      { max: 0.2, label: "10–20%", color: ORANGE[1] },
      { max: 0.35, label: "20–35%", color: ORANGE[2] },
      { max: 0.5, label: "35–50%", color: ORANGE[3] },
      { max: 0.75, label: "50–75%", color: ORANGE[4] },
      { max: Infinity, label: "75–100%", color: ORANGE[5] },
    ],
    // Height stays value per acre, so tall-but-orange parcels are valuable land holding little building.
    heightField: "vpa",
    heights: VALUE_HEIGHTS,
  },
];

export function metricConfig(id: ParcelMetric): MetricConfig {
  return MAP_METRICS.find((metric) => metric.id === id) ?? MAP_METRICS[0];
}

export function colorExpression(metric: MetricConfig): unknown[] {
  const expression: unknown[] = ["case", ["!", ["has", metric.field]], NO_DATA_COLOR];
  for (const bin of metric.bins) {
    if (bin.max === Infinity) expression.push(bin.color);
    else expression.push(["<", ["get", metric.field], bin.max], bin.color);
  }
  return expression;
}

export function heightExpression(metric: MetricConfig): unknown[] {
  return [
    "case",
    ["!", ["has", metric.heightField]],
    0,
    ["interpolate", ["linear"], ["get", metric.heightField], ...metric.heights.flat()],
  ];
}

export function areaFilter(cities: string[] | null): unknown[] {
  return cities === null ? ["all"] : ["in", ["get", "city"], ["literal", cities]];
}
