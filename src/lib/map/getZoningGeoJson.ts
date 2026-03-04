import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchZoningGeoJSON } from "@/lib/api";

function normalizeZoningCodes(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  for (const feature of data.features) {
    const props = feature.properties as Record<string, unknown> | null;
    if (!props) continue;
    if (props.zoning_code === "MHP") props.zoning_code = "MHC";
    if (props.zoning_description === "MHP") props.zoning_description = "MHC";
  }
  return data;
}

export async function getZoningGeoJson(): Promise<GeoJSON.FeatureCollection> {
  // Prefer live GIS data at runtime.
  try {
    const live = await fetchZoningGeoJSON();
    return normalizeZoningCodes(live);
  } catch {
    // Fall back to local static file so routes never depend on localhost URLs.
    const filePath = path.join(process.cwd(), "src/data/Zoning_-_Zoning_Classifications.geojson");
    const raw = await readFile(filePath, "utf-8");
    const local = JSON.parse(raw) as GeoJSON.FeatureCollection;
    return normalizeZoningCodes(local);
  }
}
