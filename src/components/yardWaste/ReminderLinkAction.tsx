"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cardClass } from "@/components/crashes/shared";

type State =
  | { kind: "ready" }
  | { kind: "working" }
  | { kind: "done"; title: string; text: string }
  | { kind: "error"; text: string };

const dayText = (days: number) => (days === 1 ? "the day before" : `${days} days before`);

/**
 * Confirm or unsubscribe from a yard waste reminder, from the link in an email.
 *
 * Confirming happens as soon as the page opens in a browser, so the email's button is the only click. It runs from
 * JavaScript after the page loads, so link scanners that only fetch the page (most email security scanners) don't
 * confirm on their own; a scanner that runs JavaScript could, which is acceptable for reminders that every email lets
 * you unsubscribe from. Unsubscribing still takes a click on the page, so a scanner can't silently stop someone's
 * reminders (mail apps' one-click unsubscribe uses the List-Unsubscribe header instead).
 */
export function ReminderLinkAction() {
  const params = useSearchParams();
  const confirmToken = params.get("confirm");
  const unsubscribeToken = params.get("unsubscribe");
  const [state, setState] = useState<State>({ kind: confirmToken ? "working" : "ready" });
  const confirmStarted = useRef(false);

  useEffect(() => {
    if (!confirmToken || confirmStarted.current) return;
    confirmStarted.current = true;
    void confirm();
    // confirm only reads confirmToken; run once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmToken]);

  const back = (
    <Link href="/data/yard-waste" className="mt-6 inline-block text-sm text-[var(--color-accent-secondary)] underline">
      Back to the yard waste map
    </Link>
  );

  if (!confirmToken && !unsubscribeToken) {
    return (
      <div className={`${cardClass} p-6`}>
        <h1 className="text-2xl font-bold">Yard waste reminders</h1>
        <p className="mt-2 text-sm text-slate-700">
          This page handles the links in reminder emails. Sign up for reminders from the yard waste map.
        </p>
        {back}
      </div>
    );
  }

  async function confirm() {
    setState({ kind: "working" });
    try {
      const response = await fetch("/api/yard-waste/reminders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: confirmToken }),
      });
      const body = (await response.json().catch(() => null)) as {
        status?: string;
        address?: string;
        zoneId?: string;
        daysBefore?: number;
        first?: { kind: "sent-now" | "scheduled" | "none-left"; pickup?: string; date?: string };
        error?: string;
      } | null;
      if (body?.status === "confirmed" || body?.status === "already-confirmed") {
        setState({
          kind: "done",
          title: body.status === "confirmed" ? "You're signed up" : "Already confirmed",
          text: [
            `We'll email you ${dayText(body.daysBefore ?? 1)} each yard waste pickup at ${body.address} (zone ${body.zoneId}).`,
            body.first?.kind === "sent-now"
              ? `Your next pickup is ${body.first.pickup}, so we just emailed you a reminder.`
              : body.first?.kind === "scheduled"
                ? `Your first reminder arrives ${body.first.date} in the morning, for the pickup on ${body.first.pickup}.`
                : body.first?.kind === "none-left"
                  ? "There are no more pickups left this season for your zone."
                  : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else if (body?.status === "expired") {
        setState({ kind: "error", text: "This link has expired. Sign up again from the yard waste map." });
      } else if (body?.status === "not-found") {
        setState({ kind: "error", text: "We couldn't find this sign-up. It may have been replaced by a newer one." });
      } else {
        setState({ kind: "error", text: body?.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setState({ kind: "error", text: "Something went wrong. Check your connection and try again." });
    }
  }

  async function unsubscribe() {
    setState({ kind: "working" });
    try {
      const response = await fetch("/api/yard-waste/reminders/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: unsubscribeToken }),
      });
      const body = (await response.json().catch(() => null)) as { status?: string; address?: string; error?: string } | null;
      if (body?.status === "unsubscribed") {
        setState({
          kind: "done",
          title: "Unsubscribed",
          text: `You won't get any more yard waste reminders for ${body.address}.`,
        });
      } else if (body?.status === "not-found") {
        setState({ kind: "error", text: "We couldn't find this reminder. You may already be unsubscribed." });
      } else {
        setState({ kind: "error", text: body?.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setState({ kind: "error", text: "Something went wrong. Check your connection and try again." });
    }
  }

  const isConfirm = Boolean(confirmToken);
  return (
    <div className={`${cardClass} p-6`}>
      {state.kind === "done" ? (
        <>
          <h1 className="text-2xl font-bold">{state.title}</h1>
          <p className="mt-2 text-sm text-slate-700">{state.text}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">
            {isConfirm ? (state.kind === "error" ? "Couldn't confirm" : "Confirming your reminders…") : "Unsubscribe from reminders"}
          </h1>
          {!isConfirm && (
            <p className="mt-2 text-sm text-slate-700">Stop the yard waste pickup reminders for this address.</p>
          )}
          {/* Confirming starts on its own; the button only appears to unsubscribe, or to retry a failed confirm. */}
          {(!isConfirm || state.kind === "error") && (
            <button
              type="button"
              onClick={isConfirm ? confirm : unsubscribe}
              disabled={state.kind === "working"}
              className="mt-5 rounded-[4px] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {state.kind === "working" ? "Working…" : isConfirm ? "Try again" : "Unsubscribe"}
            </button>
          )}
          {state.kind === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.text}
            </p>
          )}
        </>
      )}
      <div>{back}</div>
    </div>
  );
}
