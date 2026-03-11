import { readFile } from "node:fs/promises";
import path from "node:path";

let zoningCache: GeoJSON.FeatureCollection | null = null;

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
  if (zoningCache) return zoningCache;

  // Use the committed local snapshot to avoid runtime ISR cache churn on oversized GIS responses.
  const filePath = path.join(process.cwd(), "src/data/Zoning_-_Zoning_Classifications.geojson");
  const raw = await readFile(filePath, "utf-8");
  const local = JSON.parse(raw) as GeoJSON.FeatureCollection;
  zoningCache = normalizeZoningCodes(local);
  return zoningCache;
}
