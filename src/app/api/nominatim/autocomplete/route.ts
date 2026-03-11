import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const limit = await rateLimit({ bucket: "nominatim-autocomplete", identifier: ip, limit: 60, windowSec: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { predictions: [], source: "nominatim", error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ predictions: [], source: "nominatim" });
  if (q.length > 160) {
    return NextResponse.json({ predictions: [], source: "nominatim", error: "Query too long" }, { status: 400 });
  }

  const fallbackQuery = /champaign|urbana/i.test(q) ? q : `${q}, Champaign, IL`;
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(fallbackQuery)}` +
    "&format=json&addressdetails=1&limit=6&countrycodes=us";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AbundantCU/1.0 (abundantcu@gmail.com)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ predictions: [], source: "nominatim", error: "Lookup failed" }, { status: 502 });
  }

  const rows = (await response.json()) as Array<{ display_name: string; place_id: string | number }>;
  const predictions = Array.isArray(rows)
    ? rows.map((row) => ({
        description: row.display_name,
        placeId: `nominatim-${row.place_id}`,
        primaryText: row.display_name.split(",")[0] ?? row.display_name,
        secondaryText: row.display_name,
      }))
    : [];

  return NextResponse.json({ predictions, source: "nominatim" });
}
