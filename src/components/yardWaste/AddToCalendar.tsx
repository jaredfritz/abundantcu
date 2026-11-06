"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, outlookCalendarUrl, type Pickup, type YardWasteZone } from "@/lib/yardWaste";

type Platform = "apple" | "android" | "other";

/**
 * A best guess at the calendar someone uses, from their device. Websites can't see which calendar app is set up, so
 * this only decides which option is listed first.
 */
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; both use Apple Calendar.
  if (/iphone|ipad|ipod|macintosh/i.test(ua)) return "apple";
  return "other";
}

interface CalendarOption {
  id: "apple" | "google" | "outlook" | "office";
  label: string;
  href: string;
  external: boolean;
}

function calendarOptions(zone: YardWasteZone, pickup: Pickup, address: string, platform: Platform): CalendarOption[] {
  const options: CalendarOption[] = [
    {
      id: "apple",
      label: "Apple Calendar",
      href: `/api/yard-waste/calendar?zone=${encodeURIComponent(zone.id)}&date=${pickup.start}`,
      external: false,
    },
    { id: "google", label: "Google Calendar", href: googleCalendarUrl(zone, pickup, address), external: true },
    { id: "outlook", label: "Outlook.com", href: outlookCalendarUrl(zone, pickup, "personal", address), external: true },
    { id: "office", label: "Microsoft 365", href: outlookCalendarUrl(zone, pickup, "work", address), external: true },
  ];
  const first = platform === "android" ? "google" : platform === "apple" ? "apple" : null;
  return first ? [...options.filter((o) => o.id === first), ...options.filter((o) => o.id !== first)] : options;
}

/**
 * "Add to calendar" for one pickup: a small button that opens a list of calendars, the likely one for this device
 * first. Apple Calendar gets a calendar file (iPhones and Macs open it in Calendar); the others open a prefilled event.
 */
export function AddToCalendar({
  zone,
  pickup,
  address,
  open,
  onOpenChange,
}: {
  zone: YardWasteZone;
  pickup: Pickup;
  address: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [platform, setPlatform] = useState<Platform>("other");
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => setPlatform(detectPlatform()), []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onOpenChange(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        <CalendarPlus aria-hidden className="h-4 w-4" />
        Add to calendar
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-[4px] border border-[var(--color-border)] bg-white py-1 shadow-lg"
        >
          {calendarOptions(zone, pickup, address, platform).map((option) => (
            <a
              key={option.id}
              role="menuitem"
              href={option.href}
              {...(option.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => onOpenChange(false)}
              className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              {option.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
