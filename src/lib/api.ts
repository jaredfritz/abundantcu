const BASE = "https://gisportal.champaignil.gov/ms/rest/services/Open_Data/Open_Data/MapServer";

export async function fetchZoningGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(
    `${BASE}/15/query?outFields=*&where=1%3D1&f=geojson`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`GIS API error: ${res.status}`);
  return res.json();
}

/** Fetches layer 1 (City Council Districts / city boundary polygon). */
export async function fetchCityBoundary(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(
    `${BASE}/1/query?where=1%3D1&outFields=*&resultRecordCount=100&f=geojson`,
    { next: { revalidate: 86400 } } // cache 24h — boundary rarely changes
  );
  if (!res.ok) throw new Error(`City boundary API error: ${res.status}`);
  return res.json();
}
