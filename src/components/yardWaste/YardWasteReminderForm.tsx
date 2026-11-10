"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { trackYardWaste } from "@/lib/yardWasteTrack";
import { REMINDER_DAY_OPTIONS, YARD_WASTE, type YardWasteZone } from "@/lib/yardWaste";
import { InfoTip } from "./InfoTip";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};
const turnstileApi = () => (window as Window & { turnstile?: TurnstileApi }).turnstile;

interface YardWasteReminderFormProps {
  address: string;
  lat: number;
  lng: number;
  zone: YardWasteZone;
  /** Whether this deployment can send email (Supabase and Resend configured) */
  enabled: boolean;
}

/**
 * Sign-up for an email reminder a few days before each of this season's remaining pickups in the searched address's
 * zone, with an opt-in (unchecked) to hear when reminders open for a future season.
 */
export function YardWasteReminderForm({ address, lat, lng, zone, enabled }: YardWasteReminderFormProps) {
  const [email, setEmail] = useState("");
  const [daysBefore, setDaysBefore] = useState<number>(1);
  const [futureUpdates, setFutureUpdates] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const turnstileToken = useRef("");

  // The site loads Turnstile's script for every page; this form appears after a search, so render it explicitly.
  useEffect(() => {
    if (!enabled || !TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mount = () => {
      if (cancelled) return;
      const api = turnstileApi();
      if (!api || !turnstileRef.current) {
        timer = setTimeout(mount, 300);
        return;
      }
      widgetId.current = api.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (value: string) => {
          turnstileToken.current = value;
        },
        "expired-callback": () => {
          turnstileToken.current = "";
        },
      });
    };
    mount();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (widgetId.current) turnstileApi()?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [enabled]);

  // A new address starts a new sign-up.
  useEffect(() => {
    setStatus("idle");
    setMessage("");
  }, [address]);

  if (!enabled) {
    return (
      <p className="border-t border-[var(--color-border)] pt-4 text-sm text-slate-600">
        Prefer email? Sign up for the city&apos;s{" "}
        <a href={YARD_WASTE.meta.cityEmailListUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Public Works notification emails
        </a>
        .
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setStatus("submitting");
    setMessage("");
    const honeypot = (event.currentTarget.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    try {
      const response = await fetch("/api/yard-waste/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          address,
          lat,
          lng,
          daysBefore,
          futureUpdates,
          honeypot,
          turnstileToken: turnstileToken.current,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Couldn't sign you up. Please try again.");
      setStatus("sent");
      trackYardWaste("reminder_submit", { zone: zone.id });
      setMessage(`Almost done: we sent a confirmation link to ${email}. Reminders start once you click it.`);
    } catch (error) {
      setStatus("error");
      trackYardWaste("reminder_error", { zone: zone.id });
      setMessage(error instanceof Error ? error.message : "Couldn't sign you up. Please try again.");
    } finally {
      turnstileToken.current = "";
      if (widgetId.current) turnstileApi()?.reset(widgetId.current);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border-t border-[var(--color-border)] pt-4 text-sm">
      <p className="flex items-center gap-1 font-semibold">
        Email reminders
        <InfoTip label="About email reminders">
          For zone {zone.id}&apos;s remaining {YARD_WASTE.meta.label} pickups; they stop after the last one. We email you
          to confirm first. We keep your email and this address to send these reminders and, only if you check the box,
          to tell you when you can sign up again. Every email has an unsubscribe link.
        </InfoTip>
      </p>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {status === "sent" ? (
        <p role="status" className="mt-2 text-emerald-700">
          {message}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="yard-waste-email" className="sr-only">
              Email address
            </label>
            <input
              id="yard-waste-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[4px] border border-[var(--color-border)] bg-white px-3 py-2 outline-none placeholder:text-slate-400 focus:border-[var(--color-accent-secondary)]"
            />
            <div className="flex gap-2">
            <label htmlFor="yard-waste-days" className="sr-only">
              When to remind me
            </label>
            <select
              id="yard-waste-days"
              value={daysBefore}
              onChange={(event) => setDaysBefore(Number(event.target.value))}
              className="min-w-0 flex-1 rounded-[4px] border border-[var(--color-border)] bg-white px-2 py-2"
            >
              {REMINDER_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days === 1 ? "The day before" : `${days} days before`}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={status === "submitting" || !email}
              className="shrink-0 rounded-[4px] bg-[var(--color-primary)] px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {status === "submitting" ? "Sending…" : "Remind me"}
            </button>
            </div>
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={futureUpdates}
              onChange={(event) => setFutureUpdates(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            />
            Email me when reminders open for future seasons
          </label>
          {TURNSTILE_SITE_KEY && <div ref={turnstileRef} className="mt-2" />}
          {message && (
            <p role="alert" className="mt-2 text-red-700">
              {message}
            </p>
          )}
        </>
      )}
    </form>
  );
}
