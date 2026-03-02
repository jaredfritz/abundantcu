import { fetchZoningGeoJSON } from "@/lib/api";
import ZoningClient from "@/components/ZoningClient";

export default async function Home() {
  let data: GeoJSON.FeatureCollection;
  try {
    data = await fetchZoningGeoJSON();
  } catch (e) {
    console.error("Failed to fetch from GIS API:", e);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/zoning`);
    data = await res.json();
  }

  return <ZoningClient data={data} />;
}
