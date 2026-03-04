"use client";

import { FormEvent, useState } from "react";

interface EmailSignupFormProps {
  sourcePage: string;
  compact?: boolean;
}

export default function EmailSignupForm({ sourcePage, compact = false }: EmailSignupFormProps) {
  const [email, setEmail] = useState("");
  const [curbanismOptIn, setCurbanismOptIn] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const honeypot = (form.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          curbanismOptIn,
          sourcePage,
          honeypot,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to submit.");
      }

      setStatus("success");
      setMessage("Thanks. You are on the list.");
      setEmail("");
      setCurbanismOptIn(false);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Submission failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row"}>
        <label htmlFor={`email-${sourcePage}`} className="sr-only">
          Email address
        </label>
        <input
          id={`email-${sourcePage}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-[4px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-primary)] outline-none ring-offset-0 placeholder:text-slate-500 focus:border-[var(--color-accent-secondary)]"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-[4px] bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
        >
          {status === "submitting" ? "Submitting..." : "Sign Up"}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={curbanismOptIn}
          onChange={(event) => setCurbanismOptIn(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-border)]"
        />
        Also sign up for CUrbanism local event updates.
      </label>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
