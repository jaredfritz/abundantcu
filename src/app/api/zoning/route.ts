import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "src/data/Zoning_-_Zoning_Classifications.geojson"
  );
  const data = readFileSync(filePath, "utf-8");
  return new NextResponse(data, {
    headers: { "Content-Type": "application/json" },
  });
}
