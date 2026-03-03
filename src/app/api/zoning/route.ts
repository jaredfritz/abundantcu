import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "src/data/Zoning_-_Zoning_Classifications.geojson"
  );
  const raw = readFileSync(filePath, "utf-8");
  const geojson = JSON.parse(raw) as GeoJSON.FeatureCollection;

  // Normalize legacy map label MHP to ordinance code MHC.
  for (const feature of geojson.features) {
    const props = feature.properties as Record<string, unknown> | null;
    if (!props) continue;
    if (props.zoning_code === "MHP") {
      props.zoning_code = "MHC";
    }
    if (props.zoning_description === "MHP") {
      props.zoning_description = "MHC";
    }
  }

  return NextResponse.json(geojson, {
    headers: { "Content-Type": "application/json" },
  });
}
