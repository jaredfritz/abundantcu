import { NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createReminder, ReminderError, remindersConfigured } from "@/lib/yardWasteReminders.server";

export const runtime = "nodejs";

const ALLOWED_ORIGINS = [
  "https://abundantcu.com",
  "https://www.abundantcu.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

/** Sign up for yard waste reminders. Sends a confirmation email; reminders start once it's confirmed. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && (!origin || !ALLOWED_ORIGINS.includes(origin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!remindersConfigured()) {
    return NextResponse.json({ error: "Email reminders aren't set up on this site yet." }, { status: 503 });
  }

  const ip = getRequestIp(request);
  const ipLimit = await rateLimit({ bucket: "yard-waste-reminder-ip", identifier: ip, limit: 5, windowSec: 600 });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-ups. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
    );
  }

  let body: {
    email?: unknown;
    address?: unknown;
    lat?: unknown;
    lng?: unknown;
    daysBefore?: unknown;
    honeypot?: unknown;
    turnstileToken?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // Bots fill the hidden field; pretend it worked.
  if (body.honeypot) return NextResponse.json({ ok: true });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const emailLimit = await rateLimit({ bucket: "yard-waste-reminder-email", identifier: email, limit: 3, windowSec: 3600 });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "We've sent this address several confirmation emails already. Check your inbox, or try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSec) } },
    );
  }

  const turnstileOk = await verifyTurnstileToken(typeof body.turnstileToken === "string" ? body.turnstileToken : "", ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "Please complete the verification challenge." }, { status: 400 });
  }

  try {
    const { zone } = await createReminder({
      email,
      address: typeof body.address === "string" ? body.address : "",
      lat: Number(body.lat),
      lng: Number(body.lng),
      daysBefore: Number(body.daysBefore),
    });
    return NextResponse.json({ ok: true, zoneId: zone.id });
  } catch (error) {
    if (error instanceof ReminderError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("yard waste reminder sign-up failed", error);
    return NextResponse.json({ error: "Couldn't sign you up right now. Please try again." }, { status: 500 });
  }
}
