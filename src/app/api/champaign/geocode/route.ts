import { NextRequest, NextResponse } from "next/server";
import { locatorJson, MIN_SCORE } from "@/lib/champaignLocator";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

interface Candidate {
  address: string;
  score: number;
  location: { x: number; y: number };
}

/**
 * Places an address with the City of Champaign's locator: `?magicKey=` for a picked suggestion (exact), or `?q=` for
 * typed text. Returns null below a confident score so the search can fall back to Google or OpenStreetMap.
 */
export async function GET(req: NextRequest) {
  const limit = await rateLimit({ bucket: "champaign-geocode", identifier: getRequestIp(req), limit: 60, windowSec: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { result: null, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const magicKey = req.nextUrl.searchParams.get("magicKey")?.trim() ?? "";
  if (!query && !magicKey) return NextResponse.json({ result: null });
  if (query.length > 180 || magicKey.length > 400) {
    return NextResponse.json({ result: null, error: "Query too long" }, { status: 400 });
  }

  try {
    const { candidates = [] } = await locatorJson<{ candidates?: Candidate[] }>("findAddressCandidates", {
      SingleLine: query,
      ...(magicKey ? { magicKey } : {}),
      outSR: "4326",
      maxLocations: "1",
    });
    const best = candidates[0];
    if (!best || best.score < MIN_SCORE || !Number.isFinite(best.location?.x) || !Number.isFinite(best.location?.y)) {
      return NextResponse.json({ result: null });
    }
    return NextResponse.json({
      result: { lat: best.location.y, lng: best.location.x, displayName: best.address },
      source: "champaign",
    });
  } catch {
    return NextResponse.json({ result: null, error: "City address search unavailable" });
  }
}
