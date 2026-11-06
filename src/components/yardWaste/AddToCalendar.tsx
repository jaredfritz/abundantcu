"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { formatPickup, googleCalendarUrl, type Pickup, type YardWasteZone } from "@/lib/yardWaste";

const linkClass =
  "inline-flex items-center rounded-[4px] border border-[var(--color-border)] bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50";

const icsUrl = (zone: YardWasteZone, pickup?: Pickup) =>
  `/api/yard-waste/calendar?zone=${encodeURIComponent(zone.id)}${pickup ? `&date=${pickup.start}` : ""}`;

/**
 * Adds this season's remaining pickups to a calendar, one at a time or all at once. Google gets a prefilled event per
 * pickup; Apple Calendar and Outlook get a calendar file, which iPhones and Macs open straight in Calendar.
 */
export function AddToCalendar({ zone, upcoming, address }: { zone: YardWasteZone; upcoming: Pickup[]; address: string }) {
  const [open, setOpen] = useState(false);
  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-[4px] border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="yard-waste-calendar-options"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <CalendarPlus aria-hidden className="h-4 w-4" />
          Add to calendar
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="yard-waste-calendar-options" className="space-y-3 border-t border-[var(--color-border)] px-3 py-3">
          {upcoming.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-slate-700">All {upcoming.length} remaining pickups</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <a href={icsUrl(zone)} className={linkClass}>
                  Apple / Outlook
                </a>
                <span className="text-[11px] text-slate-500">For Google, add each date below.</span>
              </div>
            </div>
          )}
          <ul className="space-y-1.5">
            {upcoming.map((pickup) => (
              <li key={pickup.start} className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-sm text-slate-800">{formatPickup(pickup)}</span>
                <span className="flex gap-1.5">
                  <a href={googleCalendarUrl(zone, pickup, address)} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Google
                  </a>
                  <a href={icsUrl(zone, pickup)} className={linkClass}>
                    Apple / Outlook
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-snug text-slate-500">
            Adds this season&apos;s dates once; they won&apos;t change if the city updates its schedule. Apple and Outlook
            events include an alert at 6 p.m. the evening before.
          </p>
        </div>
      )}
    </div>
  );
}
