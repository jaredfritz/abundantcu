import { NextRequest, NextResponse } from "next/server";

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

export async function GET(req: NextRequest) {
  const key = getApiKey();
  if (!key) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";

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
