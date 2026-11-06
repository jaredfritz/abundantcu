import { NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { remindersConfigured, unsubscribeReminder } from "@/lib/yardWasteReminders.server";

export const runtime = "nodejs";

/**
 * Stops a reminder. Two callers: the unsubscribe page (JSON body { token }), and mail apps' one-click unsubscribe
 * from the List-Unsubscribe header (RFC 8058), which POST "List-Unsubscribe=One-Click" with the token in the URL.
 */
export async function POST(request: Request) {
  if (!remindersConfigured()) {
    return NextResponse.json({ error: "Email reminders aren't set up on this site yet." }, { status: 503 });
  }
  const limit = await rateLimit({
    bucket: "yard-waste-reminder-unsubscribe",
    identifier: getRequestIp(request),
    limit: 30,
    windowSec: 600,
  });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token && request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    token = typeof body?.token === "string" ? body.token.trim() : "";
  }
  if (!token || token.length > 100) return NextResponse.json({ status: "not-found" }, { status: 404 });

  try {
    const result = await unsubscribeReminder(token);
    if (!result) return NextResponse.json({ status: "not-found" }, { status: 404 });
    return NextResponse.json({ status: "unsubscribed", address: result.address });
  } catch (error) {
    console.error("yard waste reminder unsubscribe failed", error);
    return NextResponse.json({ error: "Couldn't unsubscribe right now. Please try again." }, { status: 500 });
  }
}
