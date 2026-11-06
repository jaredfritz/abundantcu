"use client";

import { BellRing } from "lucide-react";
import { YARD_WASTE, type YardWasteZone } from "@/lib/yardWaste";

// Abundant CU's site emails reminders before each pickup (Supabase, Resend, and a daily cron job). That isn't part of
// the open-source tools, so this version points to the city's own notification emails instead.

interface YardWasteReminderFormProps {
  address: string;
  lat: number;
  lng: number;
  zone: YardWasteZone;
  enabled: boolean;
}

export function YardWasteReminderForm(_props: YardWasteReminderFormProps) {
  return (
    <div className="rounded-[4px] border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-slate-700">
      <p className="flex items-center gap-2 font-semibold">
        <BellRing aria-hidden className="h-4 w-4" />
        Get reminders
      </p>
      <p className="mt-1">
        Add the dates to your calendar, or sign up for the city&apos;s{" "}
        <a href={YARD_WASTE.meta.cityEmailListUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Public Works notification emails
        </a>
        .
      </p>
    </div>
  );
}
