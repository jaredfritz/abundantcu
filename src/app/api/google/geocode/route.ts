import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const limit = await rateLimit({
    bucket: "google-geocode",
    identifier: ip,
    limit: 45,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { result: null, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const key = getApiKey();
  if (!key) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length > 180) {
    return NextResponse.json({ result: null, error: "Query too long" }, { status: 400 });
  }

  const params = new URLSearchParams({ key });
  if (placeId) {
    params.set("place_id", placeId);
  } else if (query) {
    const fullQuery = /champaign|urbana/i.test(query) ? query : `${query}, Champaign, IL`;
    params.set("address", fullQuery);
    params.set("components", "country:US|locality:Champaign");
  } else {
    return NextResponse.json({ result: null });
  }

  const url = `${GEOCODE_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Geocode lookup failed" }, { status: 502 });
  }

  const payload = await res.json();
  if (payload.status !== "OK" || !payload.results?.length) {
    return NextResponse.json({ result: null });
  }

  const first = payload.results[0];
  const location = first.geometry?.location;
  if (!location) return NextResponse.json({ result: null });

  return NextResponse.json({
    result: {
      lat: location.lat,
      lng: location.lng,
      displayName: first.formatted_address ?? query,
    },
  });
}
