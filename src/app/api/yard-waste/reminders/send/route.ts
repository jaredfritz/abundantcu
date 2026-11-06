import { NextRequest, NextResponse } from "next/server";
import { remindersConfigured, sendDueReminders } from "@/lib/yardWasteReminders.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily job (vercel.json) that emails every yard waste reminder due today. Requires `Authorization: Bearer
 * <CRON_SECRET>`, which Vercel Cron sends when CRON_SECRET is set; in production it refuses to run without one.
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
    return NextResponse.json(
      { ok: true, skipped: "Email reminders aren't configured." },
      { headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const summary = await sendDueReminders();
    if (summary.errors.length > 0) console.error("yard waste reminders: some emails failed", summary.errors);
    return NextResponse.json(
      { ok: summary.errors.length === 0, ...summary },
      { status: summary.errors.length === 0 ? 200 : 502, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("yard waste reminders failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
