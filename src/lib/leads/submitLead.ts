import { LeadSubmission } from "@/lib/leads/types";

const RECENT_SUBMISSIONS = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function rateLimitKey(email: string, sourcePage: string): string {
  return `${email.toLowerCase()}::${sourcePage}`;
}

function enforceRateLimit(email: string, sourcePage: string) {
  const now = Date.now();
  const key = rateLimitKey(email, sourcePage);
  const last = RECENT_SUBMISSIONS.get(key);

  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    throw new Error("Please wait a minute before submitting again.");
  }

  RECENT_SUBMISSIONS.set(key, now);

  for (const [k, timestamp] of RECENT_SUBMISSIONS.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW_MS * 3) {
      RECENT_SUBMISSIONS.delete(k);
    }
  }
}

export async function submitLead(payload: LeadSubmission): Promise<void> {
  if (!isValidEmail(payload.email)) {
    throw new Error("Please enter a valid email address.");
  }

  enforceRateLimit(payload.email, payload.sourcePage);

  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("Lead capture is not configured yet.");
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Lead capture failed: ${response.status}`);
  }

  const notifyWebhook = process.env.OWNER_EMAIL_WEBHOOK_URL;
  if (notifyWebhook) {
    await fetch(notifyWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  }
}
