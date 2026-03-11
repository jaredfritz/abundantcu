"use client";

import { FormEvent, useState } from "react";

interface EmailSignupFormProps {
  sourcePage: string;
  compact?: boolean;
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = { reset: () => void };

export default function EmailSignupForm({ sourcePage, compact = false }: EmailSignupFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const honeypot = (form.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    const turnstileToken =
      (form.elements.namedItem("cf-turnstile-response") as HTMLInputElement | null)?.value ?? "";

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          curbanismOptIn: false,
          sourcePage,
          honeypot,
          turnstileToken,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to submit.");
      }

      setStatus("success");
      setMessage("Thanks. You are on the list.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
      turnstile?.reset?.();
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
          className={`w-full rounded-[4px] border border-[var(--color-border)] bg-white text-sm text-[var(--color-primary)] outline-none ring-offset-0 placeholder:text-slate-500 focus:border-[var(--color-accent-secondary)] ${
            compact ? "px-3.5 py-2.5" : "px-4 py-3"
          }`}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className={`shrink-0 whitespace-nowrap rounded-[4px] bg-[var(--color-primary)] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70 ${
            compact ? "px-4 py-2.5" : "px-5 py-3"
          }`}
        >
          {status === "submitting" ? "Submitting..." : "Sign Up"}
        </button>
      </div>
      {TURNSTILE_SITE_KEY ? (
        <div
          className="cf-turnstile"
          data-sitekey={TURNSTILE_SITE_KEY}
          data-theme="light"
          data-size="flexible"
        />
      ) : null}
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
