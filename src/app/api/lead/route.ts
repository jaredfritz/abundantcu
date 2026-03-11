import { NextResponse } from "next/server";
import { submitLead } from "@/lib/leads/submitLead";
import { LeadSubmission } from "@/lib/leads/types";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const ALLOWED_ORIGINS = [
  "https://abundantcu.com",
  "https://www.abundantcu.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" && (!origin || !ALLOWED_ORIGINS.includes(origin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ip = getRequestIp(request);
    const ipLimit = await rateLimit({
      bucket: "lead-ip",
      identifier: ip,
      limit: 6,
      windowSec: 60,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      curbanismOptIn?: boolean;
      sourcePage?: string;
      honeypot?: string;
      turnstileToken?: string;
    };

    if (body.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const email = body.email?.trim() ?? "";
    const sourcePage = body.sourcePage?.trim().slice(0, 120) ?? "unknown";
    const emailLimit = await rateLimit({
      bucket: "lead-email",
      identifier: `${email.toLowerCase()}::${sourcePage}`,
      limit: 3,
      windowSec: 3600,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "That email has been submitted recently. Please try later." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSec) } }
      );
    }

    const turnstileOk = await verifyTurnstileToken(body.turnstileToken ?? "", ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Please complete the verification challenge." }, { status: 400 });
    }

    const payload: LeadSubmission = {
      email,
      curbanismOptIn: Boolean(body.curbanismOptIn),
      sourcePage,
      submittedAt: new Date().toISOString(),
    };

    await submitLead(payload);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to submit right now. Please try again." }, { status: 400 });
  }
}
