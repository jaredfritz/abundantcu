// The City of Champaign's own address locator (ArcGIS GeocodeServer), built from the city's address points. It
// forgives the ways people type addresses ("1001 w healey", "309 w university av") and places results on the address
// point rather than an estimate along the street. Server-side helpers for /api/champaign/*.

export const CHAMPAIGN_LOCATOR =
  "https://gisportal.champaignil.gov/hs/rest/services/Geocoding/COC_Composite_Locator/GeocodeServer";

/** Matches below this score are too loose to trust for placing a home in a zone. */
export const MIN_SCORE = 85;

export async function locatorJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${CHAMPAIGN_LOCATOR}/${path}?${new URLSearchParams({ ...params, f: "json" })}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`City locator returned ${response.status}`);
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "City locator error");
  return body;
}

/**
 * "702 Edgebrook Drive, Champaign, IL, 61820" and "702 Edgebrook Dr, Champaign, 61820" are the same address; the same
 * street number in Urbana is not.
 */
export function addressKey(text: string): string {
  const ABBR: Record<string, string> = {
    DRIVE: "DR", STREET: "ST", AVENUE: "AVE", AV: "AVE", ROAD: "RD", BOULEVARD: "BLVD", COURT: "CT", LANE: "LN",
    PLACE: "PL", CIRCLE: "CIR", PARKWAY: "PKWY", TERRACE: "TER", NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  };
  const [first = text, city = ""] = text.split(",");
  return `${first} ${city}`
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ABBR[word] ?? word)
    .join(" ");
}
