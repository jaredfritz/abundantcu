"use client";

import { useState } from "react";
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
 * Confirm or unsubscribe from a yard waste reminder, from the link in an email. Both need a click, so an email
 * security scanner opening the link doesn't act for the person.
 */
export function ReminderLinkAction() {
  const params = useSearchParams();
  const confirmToken = params.get("confirm");
  const unsubscribeToken = params.get("unsubscribe");
  const [state, setState] = useState<State>({ kind: "ready" });

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
        error?: string;
      } | null;
      if (body?.status === "confirmed" || body?.status === "already-confirmed") {
        setState({
          kind: "done",
          title: body.status === "confirmed" ? "You're signed up" : "Already confirmed",
          text: `We'll email you ${dayText(body.daysBefore ?? 1)} each yard waste pickup at ${body.address} (zone ${body.zoneId}).`,
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
          <h1 className="text-2xl font-bold">{isConfirm ? "Confirm yard waste reminders" : "Unsubscribe from reminders"}</h1>
          <p className="mt-2 text-sm text-slate-700">
            {isConfirm
              ? "Confirm to start getting an email before each City of Champaign yard waste pickup at your address."
              : "Stop the yard waste pickup reminders for this address."}
          </p>
          <button
            type="button"
            onClick={isConfirm ? confirm : unsubscribe}
            disabled={state.kind === "working"}
            className="mt-5 rounded-[4px] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {state.kind === "working" ? "Working…" : isConfirm ? "Confirm reminders" : "Unsubscribe"}
          </button>
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
