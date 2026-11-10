// Anonymous counts of what people do on /data/yard-waste, stored in Supabase (yard_waste_events) through
// /api/yard-waste/events. Only the event, the zone, and an optional detail (e.g. which calendar) are sent: no address,
// email, or identifier. Failures are ignored; tracking never gets in the way of the page.

export type YardWasteEvent =
  | "search_in_zone"
  | "search_outside"
  | "map_zone_click"
  | "calendar_open"
  | "calendar_add"
  | "reminder_submit"
  | "reminder_error";

export function trackYardWaste(event: YardWasteEvent, data: { zone?: string; detail?: string } = {}): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, zone: data.zone, detail: data.detail });
  try {
    // sendBeacon survives the page navigating away (calendar links open a new tab or download a file).
    const sent = navigator.sendBeacon?.("/api/yard-waste/events", new Blob([body], { type: "application/json" }));
    if (!sent) {
      void fetch("/api/yard-waste/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Ignore: counts are nice to have.
  }
}
