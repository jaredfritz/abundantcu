// Sends email through Resend (https://resend.com), using RESEND_API_KEY and RESEND_FROM_EMAIL.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

const ENDPOINT = "https://api.resend.com";
/** Resend accepts up to 100 emails per batch request. */
const BATCH_SIZE = 100;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function config() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email is not configured: set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  return { apiKey, from };
}

const toPayload = (from: string, email: OutgoingEmail) => ({
  from,
  to: [email.to],
  subject: email.subject,
  text: email.text,
  html: email.html,
  ...(email.headers ? { headers: email.headers } : {}),
});

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const { apiKey, from } = config();
  const response = await fetch(`${ENDPOINT}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(from, email)),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
}

/**
 * Sends many emails in batches of 100. Returns which emails went out, by index, so callers can record them; a
 * failed batch is reported and skipped rather than stopping the rest.
 */
export async function sendEmailBatch(emails: OutgoingEmail[]): Promise<{ sent: number[]; errors: string[] }> {
  const { apiKey, from } = config();
  const sent: number[] = [];
  const errors: string[] = [];
  for (let offset = 0; offset < emails.length; offset += BATCH_SIZE) {
    const chunk = emails.slice(offset, offset + BATCH_SIZE);
    try {
      const response = await fetch(`${ENDPOINT}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((email) => toPayload(from, email))),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
      chunk.forEach((_, index) => sent.push(offset + index));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { sent, errors };
}
