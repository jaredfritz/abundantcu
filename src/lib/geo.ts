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

export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
}

/** Geocodes an address string using Nominatim, biased toward Champaign IL. */
export async function geocodeAddress(query: string): Promise<GeocodedAddress | null> {
  // Append city/state if not already present to bias results
  const fullQuery = /champaign|urbana/i.test(query)
    ? query
    : `${query}, Champaign, IL`;

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(fullQuery)}` +
    `&format=json&limit=1&countrycodes=us` +
    `&viewbox=-88.4,40.0,-88.1,40.25&bounded=0`;

  const res = await fetch(url, {
    headers: { "User-Agent": "ChampaignZoningTool/1.0" },
  });

  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const results = await res.json();
  if (!results.length) return null;

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}
