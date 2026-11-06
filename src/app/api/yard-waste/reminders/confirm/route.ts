import { NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { confirmReminder, remindersConfigured } from "@/lib/yardWasteReminders.server";

export const runtime = "nodejs";

/**
 * Confirms a reminder sign-up. The emailed link opens /data/yard-waste/reminders, which POSTs here when the person
 * clicks Confirm, so link scanners that open every URL in an email don't confirm on their own.
 */
export async function POST(request: Request) {
  if (!remindersConfigured()) {
    return NextResponse.json({ error: "Email reminders aren't set up on this site yet." }, { status: 503 });
  }
  const limit = await rateLimit({
    bucket: "yard-waste-reminder-confirm",
    identifier: getRequestIp(request),
    limit: 20,
    windowSec: 600,
  });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 100) return NextResponse.json({ status: "not-found" }, { status: 404 });

  try {
    const result = await confirmReminder(token);
    return NextResponse.json(result, { status: result.status === "not-found" ? 404 : 200 });
  } catch (error) {
    console.error("yard waste reminder confirm failed", error);
    return NextResponse.json({ error: "Couldn't confirm right now. Please try again." }, { status: 500 });
  }
}
