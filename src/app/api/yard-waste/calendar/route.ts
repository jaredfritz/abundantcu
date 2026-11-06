import { NextRequest, NextResponse } from "next/server";
import { todayInChampaign, upcomingPickups, zoneById, zoneCalendar } from "@/lib/yardWaste";

export const dynamic = "force-dynamic";

/**
 * A calendar file for one zone's pickups: `?zone=O-5` for every pickup still to come this season, or
 * `?zone=O-5&date=2026-11-13` for one. Served from a link (not a browser download) so iPhones and Macs open it straight
 * in Calendar's "Add" screen. One-time events: nothing here subscribes or updates later.
 */
export function GET(request: NextRequest) {
  const zone = zoneById(request.nextUrl.searchParams.get("zone") ?? "");
  if (!zone) return NextResponse.json({ error: "Unknown zone." }, { status: 404 });

  const date = request.nextUrl.searchParams.get("date");
  const remaining = upcomingPickups(zone, todayInChampaign());
  const pickups = date ? remaining.filter((pickup) => pickup.start === date) : remaining;
  if (pickups.length === 0) {
    return NextResponse.json({ error: "That pickup has already passed." }, { status: 410 });
  }

  const name = date ? `yard-waste-${zone.id}-${date}.ics` : `yard-waste-${zone.id}.ics`;
  return new NextResponse(zoneCalendar(zone, pickups), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
