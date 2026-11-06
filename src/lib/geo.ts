/** Ray-casting point-in-polygon for a single ring (exterior boundary). */
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function metersPerDegreeLon(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function pointToSegmentDistanceMeters(
  lng: number,
  lat: number,
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const mx = metersPerDegreeLon(lat);
  const my = 110_540;
  const px = lng * mx;
  const py = lat * my;
  const x1 = lng1 * mx;
  const y1 = lat1 * my;
  const x2 = lng2 * mx;
  const y2 = lat2 * my;

  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distanceToRingMeters(lng: number, lat: number, ring: number[][]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i];
    const d = pointToSegmentDistanceMeters(lng, lat, a[0], a[1], b[0], b[1]);
    if (d < min) min = d;
  }
  return min;
}

/** Meters from [lng, lat] to the nearest edge of a polygon feature, counting holes and every part of a multipolygon. */
export function distanceToFeatureEdgeMeters(feature: GeoJSON.Feature, lng: number, lat: number): number {
  const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  if (!geom) return Number.POSITIVE_INFINITY;
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let min = Number.POSITIVE_INFINITY;
  for (const polygon of polygons) {
    for (const ring of polygon) min = Math.min(min, distanceToRingMeters(lng, lat, ring));
  }
  return min;
}

/** Returns true if [lng, lat] is inside the polygon (respecting holes). */
function pointInPolygon(lng: number, lat: number, coords: number[][][]): boolean {
  const [exterior, ...holes] = coords;
  if (!pointInRing(lng, lat, exterior)) return false;
  for (const hole of holes) {
    if (pointInRing(lng, lat, hole)) return false; // inside a hole = outside polygon
  }
  return true;
}

/**
 * Finds the first zoning feature that contains the given coordinates.
 * Returns null if the point isn't inside any zone.
 */
export function findZoneAtPoint(
  data: GeoJSON.FeatureCollection,
  lng: number,
  lat: number
): GeoJSON.Feature | null {
  for (const feature of data.features) {
    const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      if (pointInPolygon(lng, lat, geom.coordinates)) return feature;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(lng, lat, poly)) return feature;
      }
    }
  }
  return null;
}

/**
 * Finds containing zoning feature; if none is found, falls back to nearest polygon
 * edge within max distance (useful when points are geocoded to street centerlines).
 */
export function findZoneAtPointOrNearest(
  data: GeoJSON.FeatureCollection,
  lng: number,
  lat: number,
  maxDistanceMeters = 30
): GeoJSON.Feature | null {
  const containing = findZoneAtPoint(data, lng, lat);
  if (containing) return containing;

  let best: GeoJSON.Feature | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const feature of data.features) {
    const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      const d = distanceToRingMeters(lng, lat, geom.coordinates[0]);
      if (d < bestDistance) {
        bestDistance = d;
        best = feature;
      }
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        const d = distanceToRingMeters(lng, lat, poly[0]);
        if (d < bestDistance) {
          bestDistance = d;
          best = feature;
        }
      }
    }
  }

  return bestDistance <= maxDistanceMeters ? best : null;
}

export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
}

export interface AddressSuggestion {
  description: string;
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export type SuggestionSource = "champaign" | "google" | "openstreetmap";

async function fetchPredictions(url: string): Promise<AddressSuggestion[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.predictions) ? data.predictions : [];
  } catch {
    return [];
  }
}

const withCity = (q: string) => (/champaign|urbana|savoy/i.test(q) ? q : `${q}, Champaign, IL`);

/**
 * Address suggestions: the City of Champaign's own locator first (forgiving, and placed on the city's address
 * points), then Google, then OpenStreetMap.
 */
export async function autocompleteAddressWithSource(
  query: string,
): Promise<{ predictions: AddressSuggestion[]; source: SuggestionSource | null }> {
  const q = query.trim();
  if (q.length < 3) return { predictions: [], source: null };
  const city = await fetchPredictions(`/api/champaign/suggest?q=${encodeURIComponent(q)}`);
  if (city.length > 0) return { predictions: city, source: "champaign" };
  const google = await fetchPredictions(`/api/google/autocomplete?q=${encodeURIComponent(q)}`);
  if (google.length > 0) return { predictions: google, source: "google" };
  const osm = await fetchPredictions(`/api/nominatim/autocomplete?q=${encodeURIComponent(withCity(q))}`);
  return { predictions: osm, source: osm.length > 0 ? "openstreetmap" : null };
}

export async function autocompleteAddress(query: string): Promise<AddressSuggestion[]> {
  return (await autocompleteAddressWithSource(query)).predictions;
}

async function fetchResult(url: string): Promise<GeocodedAddress | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result as GeocodedAddress | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Places an address: a picked city suggestion goes straight to the city locator; typed text tries the city locator,
 * then Google, then OpenStreetMap (biased toward Champaign).
 */
export async function geocodeAddress(query: string, placeId?: string): Promise<GeocodedAddress | null> {
  if (placeId?.startsWith("coc:")) {
    const params = new URLSearchParams({ q: query, magicKey: placeId.slice(4) });
    const picked = await fetchResult(`/api/champaign/geocode?${params}`);
    if (picked) return picked;
  }
  if (!placeId || placeId.startsWith("coc:")) {
    const city = await fetchResult(`/api/champaign/geocode?q=${encodeURIComponent(query)}`);
    if (city) return city;
  }
  const googleParams = placeId && !placeId.startsWith("coc:") && !placeId.startsWith("nominatim-")
    ? `placeId=${encodeURIComponent(placeId)}`
    : `q=${encodeURIComponent(query)}`;
  const google = await fetchResult(`/api/google/geocode?${googleParams}`);
  if (google) return google;

  const res = await fetch(`/api/nominatim/geocode?q=${encodeURIComponent(withCity(query))}`);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const payload = await res.json();
  return payload?.result ?? null;
}
