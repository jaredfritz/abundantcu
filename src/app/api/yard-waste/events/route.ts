import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { zoneById } from "@/lib/yardWaste";

export const runtime = "nodejs";

const EVENTS = new Set([
  "search_in_zone",
  "search_outside",
  "map_zone_click",
  "calendar_open",
  "calendar_add",
  "reminder_submit",
  "reminder_error",
]);
const DETAILS = new Set(["apple", "google", "outlook", "office"]);
const ALLOWED_ORIGINS = ["https://abundantcu.com", "https://www.abundantcu.com"];

/**
 * Records one anonymous event from /data/yard-waste (see src/lib/yardWasteTrack.ts). Only known event names, real
 * zone IDs, and known details are stored; anything else is dropped. Always answers 204 so tracking can't break the page.
 */
export async function POST(request: Request) {
  const done = () => new Response(null, { status: 204 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return done();
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && origin && !ALLOWED_ORIGINS.includes(origin)) return done();

  const limit = await rateLimit({ bucket: "yard-waste-events", identifier: getRequestIp(request), limit: 60, windowSec: 60 });
  if (!limit.allowed) return done();

  const body = (await request.json().catch(() => null)) as { event?: unknown; zone?: unknown; detail?: unknown } | null;
  const event = typeof body?.event === "string" ? body.event : "";
  if (!EVENTS.has(event)) return done();
  const zone = typeof body?.zone === "string" && zoneById(body.zone) ? body.zone : null;
  const detail = typeof body?.detail === "string" && DETAILS.has(body.detail) ? body.detail : null;

  try {
    const db = getSupabaseAdminClient() as unknown as SupabaseClient;
    const { error } = await db.from("yard_waste_events").insert({ event, zone_id: zone, detail });
    if (error) console.error("yard waste event not recorded", error.message);
  } catch (error) {
    console.error("yard waste event not recorded", error);
  }
  return done();
}
