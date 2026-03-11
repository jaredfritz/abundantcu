import { NextResponse } from "next/server";
import { createEditorAccessRequest } from "@/lib/editors/repository";
import { notifyEditorAccessRequest } from "@/lib/editors/notifications";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const ALLOWED_ORIGINS = [
  "https://abundantcu.com",
  "https://www.abundantcu.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && (!origin || !ALLOWED_ORIGINS.includes(origin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ip = getRequestIp(request);
    const ipLimit = await rateLimit({ bucket: "editor-request-ip", identifier: ip, limit: 5, windowSec: 3600 });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      notes?: string;
      requesterUserId?: string;
      turnstileToken?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const displayName = body.displayName?.trim() ?? "";
    const notes = body.notes?.trim() ?? "";

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    if (displayName.length < 2 || displayName.length > 80) {
      return NextResponse.json({ error: "Display name must be between 2 and 80 characters." }, { status: 400 });
    }

    if (!body.requesterUserId) {
      const verified = await verifyTurnstileToken(body.turnstileToken ?? "", ip);
      if (!verified) {
        return NextResponse.json({ error: "Please complete the verification challenge." }, { status: 400 });
      }
    }

    const submission = await createEditorAccessRequest({
      email,
      displayName,
      notes: notes.slice(0, 800),
      requesterUserId: body.requesterUserId,
    });
    const requestRecord = submission.request;

    if (submission.created) {
      await notifyEditorAccessRequest(requestRecord);
    }

    return NextResponse.json({
      ok: true,
      created: submission.created,
      requestId: requestRecord.id,
      status: requestRecord.status,
    });
  } catch (error) {
    console.error("editor access request failed", error);
    return NextResponse.json({ error: "Unable to submit request right now." }, { status: 500 });
  }
}
