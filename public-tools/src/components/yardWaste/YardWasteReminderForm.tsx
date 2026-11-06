"use client";

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
    <p className="border-t border-[var(--color-border)] pt-4 text-sm text-slate-600">
      Prefer email? Sign up for the city&apos;s{" "}
      <a href={YARD_WASTE.meta.cityEmailListUrl} target="_blank" rel="noopener noreferrer" className="underline">
        Public Works notification emails
      </a>
      .
    </p>
  );
}
