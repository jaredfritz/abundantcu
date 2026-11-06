// City of Champaign yard waste collection zones and pickup dates, for /data/yard-waste and its email reminders.
// The data is built by scripts/fetch-yard-waste.mjs from the city's Public Works map services.
//
// Dates are plain "YYYY-MM-DD" strings in Champaign's local calendar. "Today" always comes from America/Chicago,
// so the page, the reminder emails, and the server agree on which pickup is next no matter where code runs.
import data from "@/data/yard-waste.json";
import { distanceToFeatureEdgeMeters, findZoneAtPointOrNearest } from "@/lib/geo";

export type ZoneColor = "orange" | "blue" | "other";

export interface Pickup {
  /** First day of the pickup, "YYYY-MM-DD" */
  start: string;
  /** Last day: the same as `start` for a single-day pickup, or the Friday of a pickup week */
  end: string;
}

export interface YardWasteZone {
  id: string;
  name: string;
  color: ZoneColor;
  weekday: string | null;
  /** The city's schedule text, e.g. "Mondays: Oct 26, Nov 9, Nov 30" */
  schedule: string;
  pickups: Pickup[];
  /** [lng, lat] for the zone's map label */
  label: [number, number];
}

export interface YardWasteData {
  meta: {
    season: "fall" | "spring";
    year: number;
    label: string;
    start: string;
    end: string;
    notes: string[];
    sourceUrl: string;
    cityMapUrl: string;
    cityPageUrl: string;
    cityEmailListUrl: string;
  };
  zones: YardWasteZone[];
  geojson: GeoJSON.FeatureCollection;
}

export const YARD_WASTE = data as unknown as YardWasteData;

/** The season the site's data covers, e.g. "fall-2026". Reminder sign-ups are tied to it. */
export const SEASON_ID = `${YARD_WASTE.meta.season}-${YARD_WASTE.meta.year}`;

/** Every pickup this season has passed (or no data). Sign-ups and calendar links close until new dates arrive. */
export function seasonOver(today: string): boolean {
  return today > YARD_WASTE.meta.end;
}

export const TIME_ZONE = "America/Chicago";

/** Reminder lead times offered on the sign-up form, in days before a pickup. */
export const REMINDER_DAY_OPTIONS = [1, 2, 3, 5, 7] as const;

/** A geocoded point this close to a zone line may belong to the zone next door. */
export const NEAR_BOUNDARY_METERS = 30;

/** Fill colors: orange and blue families, light to dark from Monday to Friday, so neighbors read apart. */
const ZONE_FILLS: Record<string, string> = {
  "O-1": "#fdd0a2",
  "O-2": "#fdae6b",
  "O-3": "#fd8d3c",
  "O-4": "#e6550d",
  "O-5": "#a63603",
  "B-1": "#c6dbef",
  "B-2": "#9ecae1",
  "B-3": "#6baed6",
  "B-4": "#3182bd",
  "B-5": "#08519c",
};

export function zoneFill(id: string): string {
  return ZONE_FILLS[id] ?? "#94a3b8";
}

/** Dark text on the light fills, white on the dark ones. */
export function zoneTextColor(id: string): string {
  return ["O-4", "O-5", "B-4", "B-5"].includes(id) ? "#ffffff" : "#0f172a";
}

export function zoneById(id: string): YardWasteZone | null {
  return YARD_WASTE.zones.find((zone) => zone.id === id) ?? null;
}

export function colorLabel(color: ZoneColor): string {
  return color === "orange" ? "Orange Zone" : color === "blue" ? "Blue Zone" : "Zone";
}

export interface ZoneMatch {
  zone: YardWasteZone;
  /** The point is near a zone line, so the neighboring zone is possible. */
  nearBoundary: boolean;
}

/**
 * The collection zone for a point, or null outside every zone (outside Champaign city limits). Points just outside a
 * zone, as street geocoders sometimes give, match the nearest zone within 30 meters.
 */
export function findYardWasteZone(lng: number, lat: number): ZoneMatch | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const feature = findZoneAtPointOrNearest(YARD_WASTE.geojson, lng, lat, NEAR_BOUNDARY_METERS);
  const zone = feature ? zoneById(String(feature.properties?.id)) : null;
  if (!feature || !zone) return null;
  const otherZoneNearby = YARD_WASTE.geojson.features.some(
    (other) => other !== feature && distanceToFeatureEdgeMeters(other, lng, lat) <= NEAR_BOUNDARY_METERS,
  );
  return { zone, nearBoundary: otherZoneNearby };
}

/** Today's date in Champaign, "YYYY-MM-DD". */
export function todayInChampaign(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const toUtc = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Pickups that haven't finished yet, in order. A pickup happening today counts. */
export function upcomingPickups(zone: YardWasteZone, today: string): Pickup[] {
  return zone.pickups.filter((pickup) => pickup.end >= today);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Formatted by hand so the server and browser render the same text. */
function parts(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month: month - 1, day, weekday };
}

/** "Wed, Nov 11", or "Apr 13–17" for a pickup week. */
export function formatPickup(pickup: Pickup): string {
  const start = parts(pickup.start);
  if (pickup.start === pickup.end) return `${WEEKDAYS[start.weekday]}, ${MONTHS[start.month]} ${start.day}`;
  const end = parts(pickup.end);
  return start.month === end.month
    ? `${MONTHS[start.month]} ${start.day}–${end.day}`
    : `${MONTHS[start.month]} ${start.day}–${MONTHS[end.month]} ${end.day}`;
}

/** "Wednesday, November 11", or "the week of April 13" for a pickup week. */
export function formatPickupLong(pickup: Pickup): string {
  const start = parts(pickup.start);
  if (pickup.start !== pickup.end) return `the week of ${MONTHS_LONG[start.month]} ${start.day}`;
  return `${WEEKDAYS_LONG[start.weekday]}, ${MONTHS_LONG[start.month]} ${start.day}`;
}

/** "Oct 26" */
export function formatShortDate(isoDate: string): string {
  const { month, day } = parts(isoDate);
  return `${MONTHS[month]} ${day}`;
}

/** "today", "tomorrow", "in 5 days" */
export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

const icsDate = (isoDate: string) => isoDate.replace(/-/g, "");
const icsEscape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

const eventTitle = (zone: YardWasteZone) => `Yard waste pickup (${zone.id})`;
const eventDescription = (zone: YardWasteZone) =>
  [
    `City of Champaign yard waste collection, zone ${zone.id}.`,
    "Put yard waste in 30-gallon paper yard waste bags within 10 feet of the curb by 6 a.m.",
    YARD_WASTE.meta.cityPageUrl,
  ].join("\n");

/**
 * A Google Calendar link that opens one pickup as a new all-day event, ready to save. Google's links hold one event,
 * so "all remaining pickups" for Google is one link per pickup.
 */
export function googleCalendarUrl(zone: YardWasteZone, pickup: Pickup, address?: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(zone),
    dates: `${icsDate(pickup.start)}/${icsDate(addDays(pickup.end, 1))}`,
    details: eventDescription(zone),
    ctz: TIME_ZONE,
  });
  if (address) params.set("location", address);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * An iCalendar file with an all-day event for each given pickup, each with an alert at 6 p.m. the evening before
 * (materials must be at the curb by 6 a.m.). These are one-time additions: nothing subscribes or updates later.
 */
export function zoneCalendar(zone: YardWasteZone, pickups: Pickup[], address?: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const description = eventDescription(zone);
  const events = pickups.map((pickup) =>
    [
      "BEGIN:VEVENT",
      `UID:yard-waste-${zone.id}-${pickup.start}@abundantcu.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(pickup.start)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(pickup.end, 1))}`,
      `SUMMARY:${icsEscape(eventTitle(zone))}`,
      `DESCRIPTION:${icsEscape(description)}`,
      ...(address ? [`LOCATION:${icsEscape(address)}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape("Put yard waste at the curb by 6 a.m. tomorrow")}`,
      "TRIGGER:-PT6H",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n"),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Abundant CU//Yard Waste//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(`Yard waste ${zone.id}`)}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
