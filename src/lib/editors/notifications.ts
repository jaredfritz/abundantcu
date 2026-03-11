import type { EditorAccessRequestRow } from "@/lib/editors/types";

const DEFAULT_RECIPIENTS = ["abundantcu@gmail.com", "jaredfritz1@gmail.com"];

function getRecipients(): string[] {
  const raw = process.env.EDITOR_NOTIFICATION_RECIPIENTS;
  if (!raw) return DEFAULT_RECIPIENTS;
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_RECIPIENTS;
}

function getAdminPortalUrl(): string | null {
  const token = process.env.EDITOR_ADMIN_TOKEN;
  if (!token) return null;

  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.abundantcu.com").replace(/\/$/, "");
  return `${base}/admin/editors?token=${encodeURIComponent(token)}`;
}

async function sendViaResend(subject: string, text: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: getRecipients(),
      subject,
      html,
      text,
    }),
    cache: "no-store",
  });

  return response.ok;
}

async function sendViaWebhook(subject: string, text: string, html: string): Promise<boolean> {
  const webhook = process.env.OWNER_EMAIL_WEBHOOK_URL;
  if (!webhook) return false;

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "editor_access_request",
      to: getRecipients(),
      subject,
      text,
      html,
    }),
    cache: "no-store",
  });

  return response.ok;
}

export async function notifyEditorAccessRequest(request: EditorAccessRequestRow): Promise<void> {
  const portalUrl = getAdminPortalUrl();

  const subject = `New Abundant CU editor access request: ${request.display_name}`;
  const lines = [
    "A new editor access request was submitted.",
    "",
    `Name: ${request.display_name}`,
    `Email: ${request.email}`,
    `Notes: ${request.notes || "(none)"}`,
    `Request ID: ${request.id}`,
  ];

  if (portalUrl) {
    lines.push("", `Review requests: ${portalUrl}`);
  }

  const text = lines.join("\n");
  const html = `
    <p>A new editor access request was submitted.</p>
    <ul>
      <li><strong>Name:</strong> ${request.display_name}</li>
      <li><strong>Email:</strong> ${request.email}</li>
      <li><strong>Notes:</strong> ${request.notes || "(none)"}</li>
      <li><strong>Request ID:</strong> ${request.id}</li>
    </ul>
    ${portalUrl ? `<p><a href="${portalUrl}">Review requests</a></p>` : ""}
  `;

  const sent = (await sendViaResend(subject, text, html)) || (await sendViaWebhook(subject, text, html));
  if (!sent) {
    console.warn("Editor access notification not sent: configure RESEND_* or OWNER_EMAIL_WEBHOOK_URL.");
  }
}
