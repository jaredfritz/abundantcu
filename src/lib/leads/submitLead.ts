import { LeadSubmission } from "@/lib/leads/types";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitLead(payload: LeadSubmission): Promise<void> {
  if (!isValidEmail(payload.email)) {
    throw new Error("Please enter a valid email address.");
  }

  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("Lead capture is not configured yet.");
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
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
      signal: AbortSignal.timeout(10_000),
    });
  }
}
