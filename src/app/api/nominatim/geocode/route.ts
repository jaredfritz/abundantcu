import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const limit = await rateLimit({ bucket: "nominatim-geocode", identifier: ip, limit: 40, windowSec: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { result: null, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ result: null });
  if (query.length > 180) {
    return NextResponse.json({ result: null, error: "Query too long" }, { status: 400 });
  }

  const fullQuery = /champaign|urbana/i.test(query) ? query : `${query}, Champaign, IL`;
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(fullQuery)}` +
    "&format=json&limit=1&countrycodes=us&viewbox=-88.4,40.0,-88.1,40.25&bounded=0";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AbundantCU/1.0 (abundantcu@gmail.com)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ result: null, error: "Lookup failed" }, { status: 502 });
  }

  const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ result: null });
  }

  const first = rows[0];
  return NextResponse.json({
    result: {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      displayName: first.display_name,
    },
  });
}
