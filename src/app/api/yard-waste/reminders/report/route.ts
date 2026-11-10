import { NextRequest, NextResponse } from "next/server";
import { remindersConfigured, sendOwnerReport } from "@/lib/yardWasteReminders.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily owner report (vercel.json, 17:00 UTC: 11 a.m.-noon in Champaign during standard time). Emails
 * YARD_WASTE_REPORT_EMAIL only when reminders went out today, a send failed, or the morning job didn't run. Requires
 * `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends; in production it refuses to run without one.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (!remindersConfigured()) {
    return NextResponse.json({ ok: true, skipped: "Email reminders aren't configured." }, { headers: { "cache-control": "no-store" } });
  }
  try {
    const summary = await sendOwnerReport();
    return NextResponse.json({ ok: true, ...summary }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("yard waste owner report failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
