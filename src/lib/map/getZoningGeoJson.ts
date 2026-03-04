export async function getZoningGeoJson(): Promise<GeoJSON.FeatureCollection> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/zoning`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load zoning data: ${response.status}`);
  }
  return response.json();
}
