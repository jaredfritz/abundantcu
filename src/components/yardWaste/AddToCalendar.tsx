"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import {
  formatPickup,
  googleCalendarUrl,
  outlookCalendarUrl,
  type Pickup,
  type YardWasteZone,
} from "@/lib/yardWaste";

type Platform = "apple" | "android" | "other";

/**
 * A best guess at the calendar someone uses, from their device. Websites can't see which calendar app is set up, so
 * this only picks the first button; every other calendar is one tap away.
 */
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; touch support tells them apart, and both use Apple Calendar.
  if (/iphone|ipad|ipod|macintosh/i.test(ua)) return "apple";
  return "other";
}

const icsUrl = (zone: YardWasteZone, pickup?: Pickup) =>
  `/api/yard-waste/calendar?zone=${encodeURIComponent(zone.id)}${pickup ? `&date=${pickup.start}` : ""}`;

const primaryClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90";
const chipClass =
  "inline-flex items-center rounded-[4px] border border-[var(--color-border)] bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50";

/**
 * Adds this season's remaining pickups to a calendar as "Put yard waste at the curb" events at 6 p.m. the evening
 * before each pickup. On Apple devices one tap adds them all to Apple Calendar; on Android it opens Google Calendar;
 * elsewhere it opens a short menu. "Other calendars" lists every option.
 */
export function AddToCalendar({ zone, upcoming, address }: { zone: YardWasteZone; upcoming: Pickup[]; address: string }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setPlatform(detectPlatform()), []);
  if (upcoming.length === 0) return null;

  const all =
    upcoming.length > 2 ? `all ${upcoming.length} pickups` : upcoming.length === 2 ? "both pickups" : "the next pickup";
  const [next, ...later] = upcoming;

  return (
    <div className="space-y-2">
      {platform === "apple" && (
        <a href={icsUrl(zone)} className={primaryClass}>
          <CalendarPlus aria-hidden className="h-4 w-4" />
          Add {all} to Apple Calendar
        </a>
      )}
      {platform === "android" && (
        <>
          <a href={googleCalendarUrl(zone, next, address)} target="_blank" rel="noopener noreferrer" className={primaryClass}>
            <CalendarPlus aria-hidden className="h-4 w-4" />
            Add {formatPickup(next)} to Google Calendar
          </a>
          {later.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              Also add:
              {later.map((pickup) => (
                <a key={pickup.start} href={googleCalendarUrl(zone, pickup, address)} target="_blank" rel="noopener noreferrer" className={chipClass}>
                  {formatPickup(pickup)}
                </a>
              ))}
            </p>
          )}
        </>
      )}

      <div className={platform === "other" ? "" : "text-center"}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="yard-waste-calendar-menu"
          className={
            platform === "other"
              ? "inline-flex w-full items-center justify-between gap-2 rounded-[4px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              : "inline-flex items-center gap-1 text-xs text-slate-600 underline hover:text-slate-900"
          }
        >
          <span className="flex items-center gap-2">
            {platform === "other" && <CalendarPlus aria-hidden className="h-4 w-4" />}
            {platform === "other" ? "Add to calendar" : "Use a different calendar"}
          </span>
          <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {menuOpen && (
        <div id="yard-waste-calendar-menu" className="space-y-3 rounded-[4px] border border-[var(--color-border)] p-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">Apple Calendar or another app</p>
            <a href={icsUrl(zone)} className={`${chipClass} mt-1`}>
              Add {all} at once
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Google or Outlook (one pickup per link)</p>
            <ul className="mt-1 space-y-1.5">
              {upcoming.map((pickup) => (
                <li key={pickup.start} className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-sm text-slate-800">{formatPickup(pickup)}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <a href={googleCalendarUrl(zone, pickup, address)} target="_blank" rel="noopener noreferrer" className={chipClass}>
                      Google
                    </a>
                    <a href={outlookCalendarUrl(zone, pickup, "personal", address)} target="_blank" rel="noopener noreferrer" className={chipClass}>
                      Outlook.com
                    </a>
                    <a href={outlookCalendarUrl(zone, pickup, "work", address)} target="_blank" rel="noopener noreferrer" className={chipClass}>
                      Microsoft 365
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-snug text-slate-500">
        Adds a &ldquo;Put yard waste at the curb&rdquo; event at 6 p.m. the evening before each pickup, with your
        calendar&apos;s usual reminder. Added once: it won&apos;t change if the city updates its schedule.
      </p>
    </div>
  );
}
