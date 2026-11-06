import { NextRequest, NextResponse } from "next/server";
import { addressKey, locatorJson } from "@/lib/champaignLocator";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

interface Suggestion {
  text: string;
  magicKey: string;
  isCollection: boolean;
}

/** Address suggestions from the City of Champaign's locator, as the address search's predictions. */
export async function GET(req: NextRequest) {
  const limit = await rateLimit({ bucket: "champaign-suggest", identifier: getRequestIp(req), limit: 120, windowSec: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { predictions: [], error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ predictions: [] });
  if (query.length > 160) return NextResponse.json({ predictions: [], error: "Query too long" }, { status: 400 });

  try {
    const { suggestions = [] } = await locatorJson<{ suggestions?: Suggestion[] }>("suggest", {
      text: query.replace(/,?\s*(champaign|il|illinois|\d{5})\b/gi, "").trim() || query,
      maxSuggestions: "8",
    });
    // The composite locator returns the same address from more than one source ("Drive, Champaign, IL" and "Dr,
    // Champaign"); keep one of each, and skip places that aren't addresses (no house number).
    const seen = new Set<string>();
    const predictions = suggestions
      .filter((s) => !s.isCollection && /^\d/.test(s.text))
      .filter((s) => {
        const key = addressKey(s.text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6)
      .map((s) => {
        const [primary, ...rest] = s.text.split(",");
        return {
          description: s.text,
          placeId: `coc:${s.magicKey}`,
          primaryText: primary.trim(),
          secondaryText: rest.join(",").trim(),
        };
      });
    return NextResponse.json({ predictions, source: "champaign" });
  } catch {
    return NextResponse.json({ predictions: [], source: "champaign", error: "City address search unavailable" });
  }
}
