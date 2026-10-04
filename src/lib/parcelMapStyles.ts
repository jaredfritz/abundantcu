// Map styling for /data/value-per-acre. Breaks and extrusion heights are adapted from Strong Towns
// Chicago's scales.js and rescaled for Champaign County, where values run lower than Chicago's.
// Chicago's red-to-green ramp is replaced with colorblind-safe ramps whose lightness runs in one
// direction, plus an optional red/blue scale centered on the selected area's average.

export const PARCEL_BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const CU_VIEW_STATE = { longitude: -88.235, latitude: 40.105, zoom: 12.2, pitch: 0, bearing: 0 };
export const VIEW_3D = { pitch: 55, bearing: -20 };

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 18;

export const VACANT_OUTLINE_COLOR = "#e34948";
// Exempt parcels and parcels without an assessment get a gray diagonal hatch, so they never read
// as a value on any color scale (including the neutral midpoint of the "vs. average" scale).
export const NO_DATA_PATTERN = "parcel-no-data-hatch";
export const NO_DATA_SWATCH =
  "repeating-linear-gradient(135deg, #a3a3a3 0 1.5px, #ececec 1.5px 4px)";

export type ParcelMetric = "value" | "tax" | "land";

/** "bands" colors by fixed dollar bands; "average" colors by how a parcel compares to the area average. */
export type ColorScale = "bands" | "average";

export const COLOR_SCALES: { id: ColorScale; label: string }[] = [
  { id: "bands", label: "Dollar bands" },
  { id: "average", label: "vs. area average" },
];

export interface Bin {
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

// Multi-hue sequential ramp (after matplotlib's "magma"): pale yellow (low) to deep purple (high).
// Lightness falls steadily, so order survives color blindness and grayscale, while the hue shifts
// keep neighboring bands distinct.
const MAGMA = ["#fcf3b0", "#fbb447", "#f47a3b", "#df405a", "#a82873", "#641a7a", "#250a4f"];
// Diverging ramp for "vs. area average" (after ColorBrewer RdBu): red below, blue above, neutral middle.
const BELOW_AVERAGE = ["#a50f26", "#d6604d", "#f4a582"];
const NEAR_AVERAGE = "#ece9e1";
const ABOVE_AVERAGE = ["#7fb6d9", "#3b86c0", "#1a4f8f"];
// Single-hue ramp for land share, light (low) to dark (high).
const ORANGE = ["#fde3d3", "#f9c0a0", "#f39a6c", "#eb6834", "#c8521f", "#9c3e14"];

export const MAP_METRICS: MetricConfig[] = [
  {
    id: "value",
    label: "Value per acre",
    field: "vpa",
    description: "Estimated market value (3 × equalized assessed value) divided by parcel area.",
    noDataLabel: "Exempt or no assessment",
    bins: [
      { max: 100_000, label: "Under $100k", color: MAGMA[0] },
      { max: 250_000, label: "$100k–$250k", color: MAGMA[1] },
      { max: 500_000, label: "$250k–$500k", color: MAGMA[2] },
      { max: 1_000_000, label: "$500k–$1M", color: MAGMA[3] },
      { max: 2_000_000, label: "$1M–$2M", color: MAGMA[4] },
      { max: 5_000_000, label: "$2M–$5M", color: MAGMA[5] },
      { max: Infinity, label: "$5M and up", color: MAGMA[6] },
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
      { max: 2_500, label: "Under $2.5k", color: MAGMA[0] },
      { max: 6_000, label: "$2.5k–$6k", color: MAGMA[1] },
      { max: 12_000, label: "$6k–$12k", color: MAGMA[2] },
      { max: 25_000, label: "$12k–$25k", color: MAGMA[3] },
      { max: 50_000, label: "$25k–$50k", color: MAGMA[4] },
      { max: 125_000, label: "$50k–$125k", color: MAGMA[5] },
      { max: Infinity, label: "$125k and up", color: MAGMA[6] },
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

// Ratio-to-average breaks for the diverging scale. The middle bin (0.8-1.25x) is "near average".
const AVERAGE_RATIOS = [0.25, 0.5, 0.8, 1.25, 2, 4];
const RATIO_LABELS = ["Under ¼ of average", "¼–½ of average", "½–0.8× average", "Near average", "1.25–2× average", "2–4× average", "4× average or more"];
const AVERAGE_COLORS = [...BELOW_AVERAGE, NEAR_AVERAGE, ...ABOVE_AVERAGE];

export function supportsAverageScale(metric: MetricConfig): boolean {
  return metric.field !== "land";
}

/** The legend bins in effect. "average" breaks are absolute values derived from the area average. */
export function binsFor(metric: MetricConfig, scale: ColorScale, average: number | null): Bin[] {
  if (scale !== "average" || !supportsAverageScale(metric) || !average || average <= 0) return metric.bins;
  return AVERAGE_COLORS.map((color, index) => ({
    max: index < AVERAGE_RATIOS.length ? average * AVERAGE_RATIOS[index] : Infinity,
    label: RATIO_LABELS[index],
    color,
  }));
}

export function colorExpression(metric: MetricConfig, bins: Bin[] = metric.bins): unknown[] {
  // No-data parcels are drawn by their own hatched layer; this color only applies in 3D, where they stay flat.
  const expression: unknown[] = ["case", ["!", ["has", metric.field]], "#d4d4d4"];
  for (const bin of bins) {
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

/** An 8x8 RGBA diagonal hatch for MapLibre's addImage, used as the no-data fill pattern. */
export function noDataHatchImage(): { width: number; height: number; data: Uint8Array } {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const onLine = (x + y) % size < 2;
      const [r, g, b, a] = onLine ? [163, 163, 163, 255] : [236, 236, 236, 220];
      data.set([r, g, b, a], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

export function areaFilter(cities: string[] | null): unknown[] {
  return cities === null ? ["all"] : ["in", ["get", "city"], ["literal", cities]];
}
