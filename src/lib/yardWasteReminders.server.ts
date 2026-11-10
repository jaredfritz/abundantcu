// Email reminders for yard waste pickups: sign-up with a confirmation email, confirming, unsubscribing, and the
// daily job that sends reminders. Server only. Needs Supabase (supabase/yard_waste_reminders_schema.sql) and Resend.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured, sendEmail, sendEmailBatch, type OutgoingEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  daysBetween,
  findYardWasteZone,
  formatPickup,
  formatPickupLong,
  relativeDays,
  SEASON_ID,
  todayInChampaign,
  upcomingPickups,
  YARD_WASTE,
  type Pickup,
  type YardWasteZone,
} from "@/lib/yardWaste";

const REMINDERS = "yard_waste_reminders";
const SENDS = "yard_waste_reminder_sends";
const JOB_LOG = "yard_waste_job_log";
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
  /** The season this sign-up is for, e.g. "fall-2026". Reminders go out only while it's the current season. */
  season: string | null;
  /** Opted in to hear when reminders open for a future season. */
  future_updates: boolean;
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


export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Emails ------------------------------------------------------------------------------------------------------
// Minimal, email-safe layout matching the site: one sans-serif family (Public Sans where installed, then Arial),
// white background, navy text and button, gray divider, small muted footer. Tables for Outlook; inline styles only.

const NAVY = "#002147";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const FONT = "'Public Sans',Arial,Helvetica,sans-serif";

/** "2004 Mayfair Road" from "2004 Mayfair Road, Champaign, IL, 61821" */
const street = (address: string) => address.split(",")[0]?.trim() || address;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function emailShell({ preview, body, footer }: { preview: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;font-family:${FONT};color:${TEXT};">
<tr><td style="padding:0 0 24px;font-size:14px;font-weight:700;color:${NAVY};">Abundant CU</td></tr>
${body}
<tr><td style="padding:24px 0 0;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:${MUTED};">${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const row_ = (html: string, padding = "0 0 8px") => `<tr><td style="padding:${padding};">${html}</td></tr>`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${NAVY};border-radius:4px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;

const footerLink = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(label)}</a>`;

export function confirmationEmail(row: ReminderRow, zone: YardWasteZone): OutgoingEmail {
  const url = confirmUrl(row);
  const where = `${street(row.address)} · Zone ${zone.id}`;
  const what = `Get an email ${daysLabel(row.days_before)} each remaining ${YARD_WASTE.meta.label} yard waste pickup.`;
  const text = [
    "Confirm your yard waste reminders",
    "",
    where,
    what,
    "",
    `Confirm: ${url}`,
    "",
    `Sent by Abundant CU because a reminder was requested here: ${pageUrl()}`,
    `Dates come from the City of Champaign and are subject to change. Confirm here for the latest information: ${YARD_WASTE.meta.cityPageUrl}`,
  ].join("\n");
  const html = emailShell({
    preview: what,
    body: [
      row_(`<h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:${NAVY};">Confirm your yard waste reminders</h1>`, "0 0 12px"),
      row_(`<p style="margin:0;font-size:16px;line-height:1.5;">${escapeHtml(where)}</p>`, "0 0 4px"),
      row_(`<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(what)}</p>`, "0 0 24px"),
      row_(button(url, "Confirm reminders"), "0 0 28px"),
    ].join("\n"),
    footer: `Sent by Abundant CU because a reminder was requested here: ${footerLink(pageUrl(), pageUrl().replace(/^https?:\/\//, ""))}. Dates come from the City of Champaign and are subject to change. Confirm ${footerLink(YARD_WASTE.meta.cityPageUrl, "here")} for the latest information.`,
  });
  return { to: row.email, subject: "Confirm your yard waste reminders", text, html };
}

export function reminderEmail(row: ReminderRow, zone: YardWasteZone, pickup: Pickup, today: string): OutgoingEmail {
  const days = daysBetween(today, pickup.start);
  const when = relativeDays(days) === "tomorrow" ? "tomorrow" : `in ${days} days`;
  const date = capitalize(formatPickupLong(pickup));
  const next = upcomingPickups(zone, today).find((later) => later.start > pickup.start);
  const where = `${street(row.address)} · Zone ${zone.id}`;
  const subject = `Yard waste pickup ${formatPickup(pickup)}`;
  const preview = `Your pickup is ${when}. Set yard waste out by 6 a.m.`;
  const guidance = "Use paper yard waste bags and follow the city's placement guidelines.";
  const disclaimer =
    "This independent reminder is for informational purposes only. Pickup details may change. Confirm the latest information with the City of Champaign.";
  const text = [
    `Yard waste pickup ${when}`,
    date,
    where,
    "",
    "Set yard waste out by 6 a.m.",
    guidance,
    ...(next ? ["", `Next pickup: ${capitalize(formatPickupLong(next))}`] : []),
    "",
    `View map and schedule: ${pageUrl()}`,
    "",
    disclaimer,
    `City of Champaign yard waste information: ${YARD_WASTE.meta.cityPageUrl}`,
    `Unsubscribe: ${manageUrl(row)}`,
  ].join("\n");
  const html = emailShell({
    preview,
    body: [
      row_(`<p style="margin:0;font-size:15px;line-height:1.4;color:#334155;">Yard waste pickup ${escapeHtml(when)}</p>`, "0 0 4px"),
      row_(`<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:700;color:${NAVY};">${escapeHtml(date)}</h1>`, "0 0 8px"),
      row_(`<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(where)}</p>`, "0 0 20px"),
      row_(`<p style="margin:0;font-size:16px;line-height:1.5;font-weight:600;">Set yard waste out by 6 a.m.</p>`, "0 0 2px"),
      row_(`<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(guidance)}</p>`, next ? "0 0 16px" : "0 0 24px"),
      ...(next
        ? [row_(`<p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">Next pickup: ${escapeHtml(capitalize(formatPickupLong(next)))}</p>`, "0 0 24px")]
        : []),
      row_(button(pageUrl(), "View map and schedule"), "0 0 28px"),
    ].join("\n"),
    footer: `${escapeHtml(disclaimer).replace("City of Champaign.", `${footerLink(YARD_WASTE.meta.cityPageUrl, "City of Champaign")}.`)} · ${footerLink(manageUrl(row), "Unsubscribe")}`,
  });
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
  futureUpdates: boolean;
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
  // Sign-ups are for this season only, so there has to be a pickup left to remind about.
  const today = todayInChampaign();
  if (!upcomingPickups(match.zone, today).some((pickup) => pickup.start > today)) {
    throw new ReminderError(`All of zone ${match.zone.id}'s ${YARD_WASTE.meta.label} pickups have passed.`);
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
    season: SEASON_ID,
    future_updates: input.futureUpdates,
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
  | {
      status: "confirmed" | "already-confirmed";
      address: string;
      zoneId: string;
      daysBefore: number;
      /** For a new confirmation: whether a reminder went out right away, or when the first one will. */
      first?: FirstReminder;
    }
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
  let first: FirstReminder | undefined;
  try {
    first = await firstReminder(row);
  } catch (error) {
    // The sign-up is confirmed either way; the daily job will pick it up.
    console.error("yard waste first reminder failed", error);
    await logJobRun("confirm", { due: 1, sent: 0, errors: [error instanceof Error ? error.message : String(error)] });
  }
  return { status: "confirmed", ...details, first };
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
      .update({ unsubscribed_at: new Date().toISOString(), future_updates: false })
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
      .eq("season", SEASON_ID)
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
  /** Reminders that came due this run and hadn't been sent before */
  due: number;
  sent: number;
  errors: string[];
}

type Delivery = { row: ReminderRow; zone: YardWasteZone; pickup: Pickup };

/**
 * Claims and sends reminders. Each (reminder, pickup) is claimed in yard_waste_reminder_sends first, so one already
 * sent (by the daily job or at confirmation) is skipped; claims for emails that fail are released so a later run
 * retries them.
 */
async function deliver(items: Delivery[], today: string): Promise<{ due: number; sent: number; errors: string[] }> {
  if (items.length === 0) return { due: 0, sent: 0, errors: [] };
  const client = db();
  const { data: claimed, error } = await client
    .from(SENDS)
    .upsert(
      items.map(({ row, pickup }) => ({ reminder_id: row.id, pickup_date: pickup.start })),
      { onConflict: "reminder_id,pickup_date", ignoreDuplicates: true },
    )
    .select("reminder_id, pickup_date");
  if (error) throw new Error(`Couldn't record reminders: ${error.message}`);
  const claimedKeys = new Set((claimed ?? []).map((row) => `${row.reminder_id}|${row.pickup_date}`));
  const toSend = items.filter(({ row, pickup }) => claimedKeys.has(`${row.id}|${pickup.start}`));
  if (toSend.length === 0) return { due: 0, sent: 0, errors: [] };

  const { sent, errors } = await sendEmailBatch(toSend.map(({ row, zone, pickup }) => reminderEmail(row, zone, pickup, today)));
  const sentSet = new Set(sent);
  const failed = toSend.filter((_, index) => !sentSet.has(index));
  for (const { row, pickup } of failed) {
    await client.from(SENDS).delete().eq("reminder_id", row.id).eq("pickup_date", pickup.start);
  }
  if (failed.length > 0) {
    errors.push(`${failed.length} reminder${failed.length === 1 ? "" : "s"} due today didn't send; the next run will retry.`);
  }
  return { due: toSend.length, sent: sent.length, errors };
}

/** Records a delivery attempt for the daily owner report. Never throws: logging must not break sending. */
export async function logJobRun(kind: "daily" | "confirm", result: { due: number; sent: number; errors: string[] }) {
  try {
    await db().from(JOB_LOG).insert({ kind, due: result.due, sent: result.sent, errors: result.errors });
  } catch (error) {
    console.error("yard waste job log failed", error);
  }
}

/**
 * Sends every reminder due today, for sign-ups made for the current season. Safe to run more than once a day: each
 * pickup is reminded once. When the data moves to a new season, earlier sign-ups stop; people who opted in to
 * future_updates can be told to sign up again.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<SendSummary> {
  const today = todayInChampaign(now);
  const rows = await activeReminders();
  const due = rows.flatMap((row) => {
    const hit = dueReminder(row, today);
    return hit ? [{ row, ...hit }] : [];
  });
  const result = await deliver(due, today);
  return { today, active: rows.length, ...result };
}

/**
 * What a newly confirmed sign-up can expect. A sign-up whose reminder window has already opened (for example,
 * confirmed the evening before a pickup, after that morning's daily run) gets its reminder right away instead of
 * missing that pickup.
 */
async function firstReminder(row: ReminderRow): Promise<FirstReminder> {
  const today = todayInChampaign();
  const hit = dueReminder(row, today);
  if (hit) {
    const result = await deliver([{ row, ...hit }], today);
    await logJobRun("confirm", result);
    if (result.sent > 0) return { kind: "sent-now", pickup: formatPickupLong(hit.pickup) };
  }
  const match = findYardWasteZone(row.lng, row.lat);
  const next = match && upcomingPickups(match.zone, today).find((pickup) => pickup.start > today);
  if (!next) return { kind: "none-left" };
  if (hit) return { kind: "sent-now", pickup: formatPickupLong(next) };
  return { kind: "scheduled", date: formatPickupLong({ start: addDays(next.start, -row.days_before), end: addDays(next.start, -row.days_before) }), pickup: formatPickupLong(next) };
}

export type FirstReminder =
  | { kind: "sent-now"; pickup: string }
  | { kind: "scheduled"; date: string; pickup: string }
  | { kind: "none-left" };

// --- Daily owner report --------------------------------------------------------------------------------------------

/** Who gets the daily report: YARD_WASTE_REPORT_EMAIL (comma-separated), else the editor notification recipients. */
function reportRecipients(): string[] {
  const raw = process.env.YARD_WASTE_REPORT_EMAIL || process.env.EDITOR_NOTIFICATION_RECIPIENTS || "abundantcu@gmail.com";
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

/** UTC instant of midnight today in Champaign: 05:00 UTC during daylight saving time, 06:00 UTC otherwise. */
export function startOfChampaignDay(now: Date): string {
  const today = todayInChampaign(now);
  for (const hour of [5, 6]) {
    const candidate = new Date(`${today}T0${hour}:00:00Z`);
    const isToday = todayInChampaign(candidate) === today;
    const before = todayInChampaign(new Date(candidate.getTime() - 1)) !== today;
    if (isToday && before) return candidate.toISOString();
  }
  return new Date(`${today}T06:00:00Z`).toISOString();
}

export interface ReportSummary {
  today: string;
  sent: number;
  errors: string[];
  dailyRan: boolean;
  emailed: boolean;
}

/**
 * Emails the owner a summary of today's reminders, only when there's something to report: reminders went out, a send
 * failed, or the morning job didn't run at all.
 */
export async function sendOwnerReport(now: Date = new Date()): Promise<ReportSummary> {
  const today = todayInChampaign(now);
  const since = startOfChampaignDay(now);
  const client = db();
  const { data: runs, error } = await client
    .from(JOB_LOG)
    .select("kind, due, sent, errors, ran_at")
    .gte("ran_at", since)
    .order("ran_at");
  if (error) throw new Error(`Couldn't read the job log: ${error.message}`);
  const rows = (runs ?? []) as { kind: string; due: number; sent: number; errors: string[]; ran_at: string }[];
  const sent = rows.reduce((sum, run) => sum + run.sent, 0);
  const errors = rows.flatMap((run) => run.errors ?? []);
  const dailyRan = rows.some((run) => run.kind === "daily");
  if (!dailyRan) errors.unshift("The morning reminder job didn't run today. Check Cron Jobs in the Vercel project.");

  const summary: ReportSummary = { today, sent, errors, dailyRan, emailed: false };
  if (sent === 0 && errors.length === 0) return summary;

  // Who got reminders today, by zone, from the sends recorded today.
  const { data: sends } = await client
    .from(SENDS)
    .select("reminder_id, yard_waste_reminders(zone_id)")
    .gte("sent_at", since);
  const byZone = new Map<string, number>();
  type Linked = { zone_id: string } | { zone_id: string }[] | null;
  for (const send of (sends ?? []) as unknown as { yard_waste_reminders: Linked }[]) {
    const linked = send.yard_waste_reminders;
    const zone = (Array.isArray(linked) ? linked[0]?.zone_id : linked?.zone_id) ?? "unknown";
    byZone.set(zone, (byZone.get(zone) ?? 0) + 1);
  }
  const { count: active } = await client
    .from(REMINDERS)
    .select("id", { count: "exact", head: true })
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null)
    .eq("season", SEASON_ID);

  const dateLabel = formatPickupLong({ start: today, end: today });
  const zones = [...byZone.entries()].sort().map(([zone, count]) => `${zone}: ${count}`).join(", ");
  const subject = errors.length > 0
    ? `Yard waste reminders: ${sent} sent, ${errors.length} issue${errors.length === 1 ? "" : "s"} (${dateLabel})`
    : `Yard waste reminders: ${sent} sent (${dateLabel})`;
  const lines = [
    `Reminders sent today: ${sent}${zones ? ` (${zones})` : ""}`,
    `Active sign-ups this season: ${active ?? "unknown"}`,
    "",
    errors.length > 0 ? "Look into:" : "No errors.",
    ...errors.map((message) => `- ${message}`),
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">
<p style="margin:0 0 8px"><strong>Reminders sent today:</strong> ${sent}${zones ? ` (${escapeHtml(zones)})` : ""}</p>
<p style="margin:0 0 16px"><strong>Active sign-ups this season:</strong> ${active ?? "unknown"}</p>
${errors.length > 0
    ? `<p style="margin:0 0 4px;color:#b91c1c"><strong>Look into:</strong></p><ul style="margin:0;padding-left:20px">${errors.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
    : `<p style="margin:0;color:#15803d">No errors.</p>`}
</div>`;
  for (const to of reportRecipients()) await sendEmail({ to, subject, text, html });
  summary.emailed = true;
  return summary;
}
