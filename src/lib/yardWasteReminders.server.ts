// Email reminders for yard waste pickups: sign-up with a confirmation email, confirming, unsubscribing, and the
// daily job that sends reminders. Server only. Needs Supabase (supabase/yard_waste_reminders_schema.sql) and Resend.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured, sendEmail, sendEmailBatch, type OutgoingEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  colorLabel,
  daysBetween,
  findYardWasteZone,
  formatPickup,
  formatPickupLong,
  relativeDays,
  todayInChampaign,
  upcomingPickups,
  YARD_WASTE,
  type Pickup,
  type YardWasteZone,
} from "@/lib/yardWaste";

const REMINDERS = "yard_waste_reminders";
const SENDS = "yard_waste_reminder_sends";
/** A confirmation link works for a week. */
const CONFIRM_TTL_DAYS = 7;
/** Most active reminders one email address can have (one per address they care about). */
const MAX_ACTIVE_PER_EMAIL = 5;
const PAGE_SIZE = 1000;

export interface ReminderRow {
  id: string;
  email: string;
  address: string;
  lat: number;
  lng: number;
  zone_id: string;
  days_before: number;
  confirm_token: string;
  unsubscribe_token: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

export class ReminderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function remindersConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && isEmailConfigured(),
  );
}

// The admin client is untyped here (no generated schema), so rows are typed by hand.
const db = () => getSupabaseAdminClient() as unknown as SupabaseClient;

const token = () => randomBytes(24).toString("base64url");

const baseUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || "https://www.abundantcu.com").replace(/\/$/, "");
const pageUrl = () => `${baseUrl()}/data/yard-waste`;
const confirmUrl = (row: Pick<ReminderRow, "confirm_token">) =>
  `${baseUrl()}/data/yard-waste/reminders?confirm=${encodeURIComponent(row.confirm_token)}`;
const manageUrl = (row: Pick<ReminderRow, "unsubscribe_token">) =>
  `${baseUrl()}/data/yard-waste/reminders?unsubscribe=${encodeURIComponent(row.unsubscribe_token)}`;
/** Target of the List-Unsubscribe header: mail apps POST to it for one-click unsubscribe (RFC 8058). */
const oneClickUrl = (row: Pick<ReminderRow, "unsubscribe_token">) =>
  `${baseUrl()}/api/yard-waste/reminders/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const daysLabel = (days: number) => (days === 1 ? "the day before" : `${days} days before`);

const zoneSummary = (zone: YardWasteZone) =>
  `zone ${zone.id}, ${colorLabel(zone.color)}${zone.weekday ? `, ${zone.weekday}s` : ""}`;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailShell(bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;padding:24px">
${bodyHtml}
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#64748b">${footerHtml}</p>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#002147;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:4px">${escapeHtml(label)}</a>`;

const RULES = [
  "Within 10 feet of the curb of a public street, by 6 a.m.",
  "In 30-gallon paper yard waste bags (other bags and containers aren't collected).",
  "At least 5 feet from trees, mailboxes, poles, and hydrants.",
  "Branches bundled with non-metal twine, no more than 2 inches thick and 3½ feet long.",
];

function confirmationEmail(row: ReminderRow, zone: YardWasteZone): OutgoingEmail {
  const url = confirmUrl(row);
  const text = [
    `Confirm to get an email ${daysLabel(row.days_before)} each City of Champaign yard waste pickup at:`,
    "",
    `${row.address}`,
    `(${zoneSummary(zone)})`,
    "",
    `Confirm: ${url}`,
    "",
    "If you didn't ask for this, ignore this email. You won't get any reminders.",
    "",
    `Abundant CU · ${pageUrl()}`,
  ].join("\n");
  const html = emailShell(
    `<h1 style="margin:0 0 12px;font-size:20px">Confirm your yard waste reminders</h1>
<p style="margin:0 0 12px;line-height:1.5">Confirm to get an email ${daysLabel(row.days_before)} each City of Champaign yard waste pickup at:</p>
<p style="margin:0 0 16px;line-height:1.5"><strong>${escapeHtml(row.address)}</strong><br><span style="color:#475569">${escapeHtml(zoneSummary(zone))}</span></p>
<p style="margin:0 0 16px">${button(url, "Confirm reminders")}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#475569">If you didn't ask for this, ignore this email. You won't get any reminders.</p>`,
    `Sent by <a href="${escapeHtml(pageUrl())}" style="color:#64748b">Abundant CU</a> because someone entered this address on our yard waste map. Abundant CU isn't the City of Champaign; check the <a href="${escapeHtml(YARD_WASTE.meta.cityPageUrl)}" style="color:#64748b">city's yard waste page</a> for official information.`,
  );
  return { to: row.email, subject: "Confirm your yard waste reminders", text, html };
}

function reminderEmail(row: ReminderRow, zone: YardWasteZone, pickup: Pickup, today: string): OutgoingEmail {
  const days = daysBetween(today, pickup.start);
  const when = formatPickupLong(pickup);
  const later = upcomingPickups(zone, today).filter((next) => next.start > pickup.start);
  const subject = `Yard waste pickup ${days === 1 ? "tomorrow" : formatPickup(pickup)}: zone ${zone.id}`;
  const laterText = later.length > 0 ? `Later pickups this ${YARD_WASTE.meta.season}: ${later.map(formatPickup).join(", ")}.` : `This is the last pickup of the ${YARD_WASTE.meta.label} collection.`;
  const text = [
    `Your next City of Champaign yard waste pickup is ${when} (${relativeDays(days)}).`,
    "",
    `${row.address}`,
    `(${zoneSummary(zone)})`,
    "",
    "Put yard waste out:",
    ...RULES.map((rule) => `- ${rule}`),
    "",
    laterText,
    "",
    `Map and full schedule: ${pageUrl()}`,
    `City yard waste page: ${YARD_WASTE.meta.cityPageUrl}`,
    "",
    `Unsubscribe: ${manageUrl(row)}`,
  ].join("\n");
  const html = emailShell(
    `<p style="margin:0 0 4px;font-size:13px;color:#475569">Yard waste pickup ${escapeHtml(relativeDays(days))}</p>
<h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(when[0].toUpperCase() + when.slice(1))}</h1>
<p style="margin:0 0 16px;line-height:1.5"><strong>${escapeHtml(row.address)}</strong><br><span style="color:#475569">${escapeHtml(zoneSummary(zone))}</span></p>
<p style="margin:0 0 6px;font-weight:bold">Put yard waste out:</p>
<ul style="margin:0 0 16px;padding-left:20px;line-height:1.5">${RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>
<p style="margin:0 0 16px;line-height:1.5;color:#475569">${escapeHtml(laterText)}</p>
<p style="margin:0">${button(pageUrl(), "See the map and schedule")}</p>`,
    `You asked <a href="${escapeHtml(pageUrl())}" style="color:#64748b">Abundant CU</a> for a reminder ${daysLabel(row.days_before)} each pickup. Dates come from the <a href="${escapeHtml(YARD_WASTE.meta.cityPageUrl)}" style="color:#64748b">City of Champaign</a>; if they differ, the city's are right. <a href="${escapeHtml(manageUrl(row))}" style="color:#64748b">Unsubscribe</a>.`,
  );
  return {
    to: row.email,
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl(row)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Saves a pending reminder and emails a link to confirm it. Nothing is sent until it's confirmed. */
export async function createReminder(input: {
  email: string;
  address: string;
  lat: number;
  lng: number;
  daysBefore: number;
}): Promise<{ zone: YardWasteZone }> {
  const email = input.email.trim().toLowerCase();
  const address = input.address.trim().slice(0, 200);
  if (!isValidEmail(email)) throw new ReminderError("Enter a valid email address.");
  if (!address) throw new ReminderError("Search for your address first.");
  if (!Number.isInteger(input.daysBefore) || input.daysBefore < 1 || input.daysBefore > 14) {
    throw new ReminderError("Choose when to be reminded.");
  }
  const match = findYardWasteZone(input.lng, input.lat);
  if (!match) {
    throw new ReminderError("That address isn't in a City of Champaign yard waste zone. Collection is only inside city limits.");
  }

  const client = db();
  const { count, error: countError } = await client
    .from(REMINDERS)
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null);
  if (countError) throw new Error(`Couldn't check reminders: ${countError.message}`);
  if ((count ?? 0) >= MAX_ACTIVE_PER_EMAIL) {
    throw new ReminderError("This email already has the most reminders we allow. Unsubscribe from one first.");
  }

  // A repeat sign-up replaces an unconfirmed one for the same address, so only the newest link works.
  const { error: deleteError } = await client
    .from(REMINDERS)
    .delete()
    .eq("email", email)
    .eq("address", address)
    .is("confirmed_at", null);
  if (deleteError) throw new Error(`Couldn't replace a pending reminder: ${deleteError.message}`);

  const row = {
    email,
    address,
    lat: input.lat,
    lng: input.lng,
    zone_id: match.zone.id,
    days_before: input.daysBefore,
    confirm_token: token(),
    unsubscribe_token: token(),
  };
  const { data, error } = await client.from(REMINDERS).insert(row).select("*").single<ReminderRow>();
  if (error || !data) throw new Error(`Couldn't save the reminder: ${error?.message}`);

  try {
    await sendEmail(confirmationEmail(data, match.zone));
  } catch (sendError) {
    await client.from(REMINDERS).delete().eq("id", data.id);
    throw sendError;
  }
  return { zone: match.zone };
}

export type ConfirmResult =
  | { status: "confirmed" | "already-confirmed"; address: string; zoneId: string; daysBefore: number }
  | { status: "expired" | "not-found" };

export async function confirmReminder(confirmToken: string): Promise<ConfirmResult> {
  const client = db();
  const { data: row, error } = await client
    .from(REMINDERS)
    .select("*")
    .eq("confirm_token", confirmToken)
    .maybeSingle<ReminderRow>();
  if (error) throw new Error(`Couldn't look up the reminder: ${error.message}`);
  if (!row || row.unsubscribed_at) return { status: "not-found" };
  const details = { address: row.address, zoneId: row.zone_id, daysBefore: row.days_before };
  if (row.confirmed_at) return { status: "already-confirmed", ...details };
  if (Date.now() - Date.parse(row.created_at) > CONFIRM_TTL_DAYS * 86_400_000) return { status: "expired" };

  const now = new Date().toISOString();
  const { error: updateError } = await client.from(REMINDERS).update({ confirmed_at: now }).eq("id", row.id);
  if (updateError) throw new Error(`Couldn't confirm the reminder: ${updateError.message}`);
  // A new confirmed sign-up for the same email and address replaces the old one (say, to change the timing).
  await client
    .from(REMINDERS)
    .update({ unsubscribed_at: now })
    .eq("email", row.email)
    .eq("address", row.address)
    .neq("id", row.id)
    .is("unsubscribed_at", null);
  return { status: "confirmed", ...details };
}

/** Stops a reminder. Returns its address, or null when the link doesn't match one. */
export async function unsubscribeReminder(unsubscribeToken: string): Promise<{ address: string } | null> {
  const client = db();
  const { data: row, error } = await client
    .from(REMINDERS)
    .select("id, address, unsubscribed_at")
    .eq("unsubscribe_token", unsubscribeToken)
    .maybeSingle<Pick<ReminderRow, "id" | "address" | "unsubscribed_at">>();
  if (error) throw new Error(`Couldn't look up the reminder: ${error.message}`);
  if (!row) return null;
  if (!row.unsubscribed_at) {
    const { error: updateError } = await client
      .from(REMINDERS)
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw new Error(`Couldn't unsubscribe: ${updateError.message}`);
  }
  return { address: row.address };
}

async function activeReminders(): Promise<ReminderRow[]> {
  const client = db();
  const rows: ReminderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(REMINDERS)
      .select("*")
      .not("confirmed_at", "is", null)
      .is("unsubscribed_at", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't load reminders: ${error.message}`);
    rows.push(...((data ?? []) as ReminderRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * The pickup a reminder is due for today, if any: the next pickup after today, once it's within the reminder's lead
 * time. A reminder the job missed (say, it didn't run yesterday) still goes out late rather than not at all.
 */
export function dueReminder(row: Pick<ReminderRow, "lat" | "lng" | "days_before">, today: string) {
  const match = findYardWasteZone(row.lng, row.lat);
  if (!match) return null;
  const pickup = upcomingPickups(match.zone, today).find((next) => next.start > today);
  if (!pickup) return null;
  const days = daysBetween(today, pickup.start);
  return days <= row.days_before ? { zone: match.zone, pickup } : null;
}

export interface SendSummary {
  today: string;
  active: number;
  due: number;
  sent: number;
  errors: string[];
}

/** Sends every reminder due today. Safe to run more than once a day: each pickup is reminded once. */
export async function sendDueReminders(now: Date = new Date()): Promise<SendSummary> {
  const today = todayInChampaign(now);
  const rows = await activeReminders();
  const due = rows.flatMap((row) => {
    const hit = dueReminder(row, today);
    return hit ? [{ row, ...hit }] : [];
  });
  const summary: SendSummary = { today, active: rows.length, due: due.length, sent: 0, errors: [] };
  if (due.length === 0) return summary;

  // Claim each (reminder, pickup) first. Rows that already exist were sent earlier and come back filtered out.
  const client = db();
  const { data: claimed, error } = await client
    .from(SENDS)
    .upsert(
      due.map(({ row, pickup }) => ({ reminder_id: row.id, pickup_date: pickup.start })),
      { onConflict: "reminder_id,pickup_date", ignoreDuplicates: true },
    )
    .select("reminder_id, pickup_date");
  if (error) throw new Error(`Couldn't record reminders: ${error.message}`);
  const claimedKeys = new Set((claimed ?? []).map((row) => `${row.reminder_id}|${row.pickup_date}`));
  const toSend = due.filter(({ row, pickup }) => claimedKeys.has(`${row.id}|${pickup.start}`));

  const { sent, errors } = await sendEmailBatch(toSend.map(({ row, zone, pickup }) => reminderEmail(row, zone, pickup, today)));
  summary.sent = sent.length;
  summary.errors = errors;

  // Release the claims for emails that didn't go out, so the next run retries them.
  const sentSet = new Set(sent);
  const failed = toSend.filter((_, index) => !sentSet.has(index));
  for (const { row, pickup } of failed) {
    await client.from(SENDS).delete().eq("reminder_id", row.id).eq("pickup_date", pickup.start);
  }
  return summary;
}
