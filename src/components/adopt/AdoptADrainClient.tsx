"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Droplets, ExternalLink, Info, Loader2, LogOut, MapPin, Sparkles, X } from "lucide-react";
import AddressSearch from "@/components/AddressSearch";
import {
  CITY_APP_URL,
  CITY_PROGRAM_URL,
  CITY_WAIVER_URL,
  NICKNAME_MAX,
  WAIVER_PARAGRAPHS,
  WAIVER_TITLE,
  drainTitle,
  type DrainAction,
  type DrainRow,
  type DrainsResponse,
  type MyDrain,
  type SessionResponse,
} from "@/lib/adoptADrain";
import { DRAIN_COLORS, type DrainFilter } from "./DrainMap";

const DrainMap = dynamic(() => import("./DrainMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  getResponse: (id?: string) => string | undefined;
  remove: (id?: string) => void;
};

function getTurnstile(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;

type Account =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "signedIn"; email: string | null; myDrains: MyDrain[] };

type EmailStep = "email" | "signup" | "sent";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
function formatDate(ms: number | null): string | null {
  return ms ? dateFormat.format(new Date(ms)) : null;
}

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** The Cloudflare check on the email form, rendered explicitly so it works whenever the form mounts. */
function TurnstileBox({ widgetRef }: { widgetRef: React.MutableRefObject<string | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function tryRender() {
      if (cancelled) return;
      const api = getTurnstile();
      if (!api || !boxRef.current) {
        timer = setTimeout(tryRender, 300);
        return;
      }
      widgetRef.current = api.render(boxRef.current, { sitekey: TURNSTILE_SITE_KEY, theme: "light", size: "flexible" });
    }
    tryRender();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (widgetRef.current) getTurnstile()?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [widgetRef]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={boxRef} className="mt-3" />;
}

export default function AdoptADrainClient() {
  const [drains, setDrains] = useState<DrainRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number; key: number } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<DrainAction | null>(null);
  const [nickname, setNickname] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [filter, setFilter] = useState<DrainFilter>("all");
  const [showSignIn, setShowSignIn] = useState(false);

  // Email / sign-up form
  const [step, setStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [team, setTeam] = useState("");
  const [teams, setTeams] = useState<string[] | null>(null);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstileId = useRef<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const urlHandled = useRef(false);
  const drainPanel = useRef<HTMLDivElement>(null);
  const accountPanel = useRef<HTMLDivElement>(null);
  const focusEmail = useRef(false);

  const mine = useMemo(
    () => new Set(account.state === "signedIn" ? account.myDrains.map((drain) => drain.id) : []),
    [account]
  );
  const byId = useMemo(() => new Map((drains ?? []).map((row) => [row[0], row])), [drains]);
  const selected = selectedId !== null ? byId.get(selectedId) ?? null : null;
  const adoptedCount = useMemo(() => (drains ?? []).filter((row) => row[3] === 1).length, [drains]);

  // Load every drain.
  useEffect(() => {
    fetch("/api/adopt-a-drain/drains")
      .then(async (res) => {
        const body = (await res.json()) as DrainsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Couldn't load drains.");
        setDrains(body.drains);
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't load drains."));
  }, []);

  const applySession = useCallback((session: SessionResponse) => {
    if (session.signedIn) {
      setAccount({ state: "signedIn", email: session.email ?? null, myDrains: session.myDrains ?? [] });
    } else {
      setAccount({ state: "signedOut" });
    }
  }, []);

  /** Keep the drain list and "my drains" in step after an action, without refetching everything. */
  const updateLocal = useCallback((id: number, action: DrainAction, drain: MyDrain | null) => {
    setDrains((rows) =>
      rows
        ? rows.map((row): DrainRow => {
            if (row[0] !== id) return row;
            if (action === "release") return [row[0], row[1], row[2], 0, null, row[5], null, row[7]];
            if (!drain) return row;
            return [row[0], row[1], row[2], 1, drain.nickname, drain.cityId, drain.adoptedAt, drain.cleanedAt];
          })
        : rows
    );
    setAccount((current) => {
      if (current.state !== "signedIn") return current;
      const others = current.myDrains.filter((item) => item.id !== id);
      return { ...current, myDrains: action === "release" || !drain ? others : [...others, drain] };
    });
  }, []);

  const runAction = useCallback(
    async (id: number, action: DrainAction, name?: string) => {
      setBusy(action);
      setNotice(null);
      try {
        const { ok, data } = await postJson<{ drain?: MyDrain | null; error?: string; signedOut?: boolean }>(
          "/api/adopt-a-drain/action",
          { id, action, nickname: name }
        );
        if (!ok) {
          if (data.signedOut) {
            setAccount({ state: "signedOut" });
            setShowSignIn(true);
          }
          setNotice({ tone: "error", text: data.error ?? "That didn't work. Please try again." });
          return false;
        }
        updateLocal(id, action, data.drain ?? null);
        const title = data.drain ? drainTitle(data.drain.nickname, data.drain.cityId, id) : "the drain";
        const messages: Record<DrainAction, string> = {
          adopt: `Thank you for adopting ${title}! It's now yours on the City's map.`,
          release: "Drain released. It's available for someone else to adopt.",
          clean: "Marked as cleaned today. Thank you!",
          rename: "Name saved.",
        };
        setNotice({ tone: "ok", text: messages[action] });
        return true;
      } catch {
        setNotice({ tone: "error", text: "Couldn't reach the server. Please try again." });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [updateLocal]
  );

  // Sign in from the City's emailed link (?userid=&usertoken=), then act on any drain the link names.
  useEffect(() => {
    if (urlHandled.current) return;
    urlHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const userid = params.get("userid");
    const usertoken = params.get("usertoken");
    const toId = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);
    const assignId = toId(params.get("assign"));
    const releaseId = toId(params.get("unassign"));
    const cleanId = toId(params.get("clean"));

    // Keep the token out of the address bar, history, and anything that reads the URL.
    if (params.size) window.history.replaceState(null, "", window.location.pathname);

    (async () => {
      if (userid && usertoken) {
        type SignInResponse = SessionResponse & { error?: string; expired?: boolean };
        const { ok, data } = await postJson<SignInResponse>("/api/adopt-a-drain/session", { userid, usertoken }).catch(
          () => ({ ok: false, status: 0, data: { signedIn: false, error: "Couldn't reach the server." } as SignInResponse })
        );
        if (!ok) {
          setAccount({ state: "signedOut" });
          if (!data.expired) setShowSignIn(true);
          setNotice({ tone: data.expired ? "info" : "error", text: data.error ?? "Sign-in didn't work." });
          if (assignId) setSelectedId(assignId);
          return;
        }
        applySession(data);
        setNotice({ tone: "ok", text: "You're signed in." });
        if (cleanId) {
          setSelectedId(cleanId);
          await runAction(cleanId, "clean");
        } else if (releaseId) {
          setSelectedId(releaseId);
          setConfirmRelease(true);
        } else if (assignId) {
          setSelectedId(assignId);
        }
        return;
      }
      if (assignId) setSelectedId(assignId);
      const { data } = await fetch("/api/adopt-a-drain/session")
        .then(async (res) => ({ data: (await res.json()) as SessionResponse & { expired?: boolean } }))
        .catch(() => ({ data: { signedIn: false } as SessionResponse & { expired?: boolean } }));
      applySession(data);
      if (data.expired) {
        setNotice({ tone: "info", text: "Your sign-in expired. The City just emailed you a new link." });
      }
    })();
  }, [applySession, runAction]);

  // Center on a drain picked from a link or the "my drains" list once drains are loaded.
  const centeredFor = useRef<number | null>(null);
  useEffect(() => {
    if (!selected || centeredFor.current === selected[0]) return;
    centeredFor.current = selected[0];
    setFlyTo((current) => ({ lng: selected[1], lat: selected[2], key: (current?.key ?? 0) + 1 }));
  }, [selected]);

  // Reset the per-drain inputs when the selection changes.
  useEffect(() => {
    setConfirmRelease((value) => (selectedId !== null ? value : false));
    const row = selectedId !== null ? byId.get(selectedId) : undefined;
    setNickname(row && mine.has(row[0]) ? row[4] ?? "" : "");
    // byId and mine change after every action; only reset when the drain itself changes.
  }, [selectedId]);

  function selectFromMap(id: number | null) {
    centeredFor.current = id;
    setSelectedId(id);
    setConfirmRelease(false);
  }

  useEffect(() => {
    if (step !== "signup" || teams !== null) return;
    fetch("/api/adopt-a-drain/teams")
      .then((res) => (res.ok ? res.json() : { enabled: false, names: [] }))
      .then((body: { enabled: boolean; names: string[] }) => {
        setTeamsEnabled(body.enabled);
        setTeams(body.names ?? []);
      })
      .catch(() => setTeams([]));
  }, [step, teams]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (step === "signup" && !accepted) {
      setFormError("Please read and accept the City's Waiver of Liability.");
      return;
    }
    const honeypot = (event.currentTarget.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    const api = getTurnstile();
    const turnstileToken = turnstileId.current ? api?.getResponse(turnstileId.current) ?? "" : "";
    setSending(true);
    try {
      const pendingAdopt = selected && selected[3] === 0 ? selected[0] : undefined;
      const { ok, data } = await postJson<{ status?: string; error?: string }>("/api/adopt-a-drain/email", {
        email,
        mode: step === "signup" ? "signup" : "login",
        firstName,
        lastName,
        team,
        acceptedWaiver: step === "signup" ? accepted : undefined,
        adoptId: pendingAdopt,
        turnstileToken,
        honeypot,
      });
      if (!ok) {
        setFormError(data.error ?? "That didn't work. Please try again.");
      } else if (data.status === "new_user") {
        setStep("signup");
      } else {
        setStep("sent");
      }
    } catch {
      setFormError("Couldn't reach the server. Please try again.");
    } finally {
      setSending(false);
      if (turnstileId.current) api?.reset(turnstileId.current);
    }
  }

  async function signOut() {
    await postJson("/api/adopt-a-drain/session", undefined, "DELETE").catch(() => null);
    setAccount({ state: "signedOut" });
    setStep("email");
    setShowSignIn(false);
    setNotice({ tone: "info", text: "Signed out." });
  }

  function startSignIn() {
    setStep((current) => (current === "sent" ? "email" : current));
    setShowSignIn(true);
    focusEmail.current = true;
  }

  // Bring the sign-in form into view once it renders.
  useEffect(() => {
    if (!showSignIn || !focusEmail.current || !emailInput.current) return;
    focusEmail.current = false;
    emailInput.current.scrollIntoView({ behavior: "smooth", block: "center" });
    emailInput.current.focus({ preventScroll: true });
  }, [showSignIn, step]);

  const signedIn = account.state === "signedIn";
  const selectedIsMine = selected ? mine.has(selected[0]) : false;
  const selectedTitle = selected ? drainTitle(selected[4], selected[5], selected[0]) : "";
  const fieldClass =
    "w-full rounded-[4px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-primary)] outline-none placeholder:text-slate-500 focus:border-[var(--color-accent-secondary)]";
  const primaryButton =
    "inline-flex items-center justify-center gap-2 rounded-[4px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60";
  const secondaryButton =
    "inline-flex items-center justify-center gap-2 rounded-[4px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Adopt a Drain</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">
        Keep a storm drain near you clear of leaves and trash to help prevent street flooding. Part of the{" "}
        <a href={CITY_PROGRAM_URL} target="_blank" rel="noreferrer" className="font-semibold underline">
          City of Champaign&apos;s program
        </a>
        ; adoptions here also show on the{" "}
        <a href={CITY_APP_URL} target="_blank" rel="noreferrer" className="font-semibold underline">
          City&apos;s map
        </a>
        .
      </p>

      {notice ? (
        <div
          role="status"
          className={`mt-4 rounded-[4px] border p-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <AddressSearch
            onResult={(result) => setFlyTo((current) => ({ lng: result.lng, lat: result.lat, key: (current?.key ?? 0) + 1 }))}
            onClear={() => undefined}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div role="group" aria-label="Show drains" className="inline-flex rounded-[4px] border border-[var(--color-border)] bg-white p-0.5 text-sm">
              {(
                [
                  ["all", "All"],
                  ["available", "Available"],
                  ["adopted", "Adopted"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-[3px] px-3 py-1.5 font-semibold transition ${
                    filter === value ? "bg-[var(--color-primary)] text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              {drains ? (
                <span>
                  {adoptedCount.toLocaleString()} of {drains.length.toLocaleString()} adopted
                </span>
              ) : null}
              {account.state === "signedOut" && !showSignIn && step !== "sent" ? (
                <button type="button" className="font-semibold text-[var(--color-primary)] underline" onClick={startSignIn}>
                  Sign in
                </button>
              ) : null}
            </div>
          </div>
          <div className="relative mt-3 h-[60vh] min-h-[380px] overflow-hidden rounded-[4px] border border-[var(--color-border)] lg:h-[640px]">
            {loadError ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-800">
                {loadError}
              </div>
            ) : drains ? (
              <DrainMap drains={drains} mine={mine} filter={filter} selectedId={selectedId} onSelect={selectFromMap} flyTo={flyTo} />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the City&apos;s drains…
              </div>
            )}
            {selected ? (
              <button
                type="button"
                className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2 rounded-[4px] bg-[var(--color-primary)] px-4 py-3 text-left text-sm font-semibold text-white shadow-md lg:hidden"
                onClick={() => drainPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <span className="truncate">
                  {selectedTitle} · {selectedIsMine ? "Yours" : selected[3] ? "Adopted" : "Available"}
                </span>
                <span className="shrink-0">Details ↓</span>
              </button>
            ) : null}
            <div
              className={`pointer-events-none absolute bottom-3 left-3 rounded-[4px] bg-white/95 px-3 py-2 text-xs shadow-sm ${
                selected ? "max-lg:hidden" : ""
              }`}
            >
              {[
                { style: DRAIN_COLORS.available, label: "Available" },
                { style: DRAIN_COLORS.adopted, label: "Adopted" },
                ...(signedIn ? [{ style: DRAIN_COLORS.mine, label: "Yours" }] : []),
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 py-0.5">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full"
                    style={{ background: item.style.fill, border: `2px solid ${item.style.stroke}` }}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {/* Selected drain */}
          <div ref={drainPanel} className="scroll-mt-20 rounded-[4px] border border-[var(--color-border)] bg-white p-4">
            {!selected ? (
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-secondary)]" />
                <p>Click a blue drain on the map to adopt it.</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {selectedIsMine ? "Your drain" : selected[3] ? "Adopted" : "Available"}
                </p>
                <h2 className="mt-1 text-xl font-bold">{selectedTitle}</h2>
                <dl className="mt-2 space-y-1 text-sm text-slate-700">
                  {selected[5] && selected[4] ? (
                    <div className="flex gap-2">
                      <dt className="text-slate-500">City ID</dt>
                      <dd>{selected[5]}</dd>
                    </div>
                  ) : null}
                  {selected[3] && formatDate(selected[6]) ? (
                    <div className="flex gap-2">
                      <dt className="text-slate-500">Adopted</dt>
                      <dd>{formatDate(selected[6])}</dd>
                    </div>
                  ) : null}
                  {selected[3] ? (
                    <div className="flex gap-2">
                      <dt className="text-slate-500">Last cleaned</dt>
                      <dd>{formatDate(selected[7]) ?? "Not logged yet"}</dd>
                    </div>
                  ) : null}
                </dl>

                {selected[3] === 0 ? (
                  <div className="mt-4 space-y-2">
                    {signedIn ? (
                      <>
                        <label className="block text-xs font-semibold text-slate-600" htmlFor="aad-nickname">
                          Name your drain (optional)
                        </label>
                        <input
                          id="aad-nickname"
                          className={fieldClass}
                          maxLength={NICKNAME_MAX}
                          value={nickname}
                          onChange={(event) => setNickname(event.target.value)}
                          placeholder="e.g. Drainy McDrainface"
                        />
                        <button
                          type="button"
                          className={`${primaryButton} w-full`}
                          disabled={busy !== null}
                          onClick={() => runAction(selected[0], "adopt", nickname)}
                        >
                          {busy === "adopt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
                          Adopt this drain
                        </button>
                        <p className="text-xs text-slate-500">
                          Names show on the public map. The City may remove inappropriate names.
                        </p>
                      </>
                    ) : (
                      <button type="button" className={`${primaryButton} w-full`} onClick={startSignIn}>
                        Sign in or sign up to adopt
                      </button>
                    )}
                  </div>
                ) : selectedIsMine ? (
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      className={`${primaryButton} w-full`}
                      disabled={busy !== null}
                      onClick={() => runAction(selected[0], "clean")}
                    >
                      {busy === "clean" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      I cleaned it today
                    </button>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600" htmlFor="aad-rename">
                        Drain name
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          id="aad-rename"
                          className={fieldClass}
                          maxLength={NICKNAME_MAX}
                          value={nickname}
                          onChange={(event) => setNickname(event.target.value)}
                          placeholder="Name your drain"
                        />
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy !== null || nickname.trim() === (selected[4] ?? "")}
                          onClick={() => runAction(selected[0], "rename", nickname)}
                        >
                          {busy === "rename" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </button>
                      </div>
                    </div>
                    {confirmRelease ? (
                      <div className="rounded-[4px] border border-red-200 bg-red-50 p-3 text-sm">
                        <p>Release this drain so someone else can adopt it?</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="rounded-[4px] bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={busy !== null}
                            onClick={async () => {
                              if (await runAction(selected[0], "release")) setConfirmRelease(false);
                            }}
                          >
                            {busy === "release" ? "Releasing…" : "Release"}
                          </button>
                          <button type="button" className={secondaryButton} onClick={() => setConfirmRelease(false)}>
                            Keep it
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-700 underline-offset-2 hover:underline"
                        onClick={() => setConfirmRelease(true)}
                      >
                        Release this drain
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Another volunteer has adopted this drain. Try one of the blue drains nearby.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account: shown once signed in, or when someone starts signing in */}
          {account.state === "signedIn" || (account.state === "signedOut" && (showSignIn || step === "sent")) ? (
          <div ref={accountPanel} className="relative scroll-mt-20 rounded-[4px] border border-[var(--color-border)] bg-white p-4">
            {account.state !== "signedIn" ? (
              <button
                type="button"
                aria-label="Close"
                className="absolute right-2 top-2 rounded-[4px] p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => {
                  setShowSignIn(false);
                  setStep("email");
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {account.state === "signedIn" ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Signed in</p>
                    <p className="truncate text-sm font-semibold">{account.email ?? "Volunteer"}</p>
                  </div>
                  <button type="button" className={secondaryButton} onClick={signOut} aria-label="Sign out" title="Sign out">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mt-4 text-sm font-bold">Your drains ({account.myDrains.length})</h3>
                {account.myDrains.length ? (
                  <ul className="mt-2 divide-y divide-[var(--color-border)] text-sm">
                    {[...account.myDrains]
                      .sort((a, b) => (b.adoptedAt ?? 0) - (a.adoptedAt ?? 0))
                      .map((drain) => (
                        <li key={drain.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 py-2 text-left hover:text-[var(--color-accent-secondary)]"
                            onClick={() => {
                              centeredFor.current = null;
                              setSelectedId(drain.id);
                            }}
                          >
                            <span className="truncate font-medium">{drainTitle(drain.nickname, drain.cityId, drain.id)}</span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {drain.cleanedAt ? `Cleaned ${formatDate(drain.cleanedAt)}` : "Not cleaned yet"}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">Click a blue drain on the map to adopt one.</p>
                )}
              </div>
            ) : step === "sent" ? (
              <div className="text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" /> Check your email
                </div>
                <p className="mt-2">
                  The City (no-reply@champaignil.gov) is emailing <strong>{email}</strong> a sign-in link. It works
                  for 24 hours.
                </p>
                <button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => setStep("email")}>
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={submitEmail} noValidate>
                <h3 className="pr-6 text-base font-bold">{step === "signup" ? "New here? Sign up" : "Sign in or sign up"}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {step === "signup"
                    ? "Add your name and accept the City's waiver."
                    : "The City will email you a sign-in link. No password needed."}
                </p>
                <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <label className="sr-only" htmlFor="aad-email">
                  Email address
                </label>
                <input
                  id="aad-email"
                  ref={emailInput}
                  type="email"
                  required
                  autoComplete="email"
                  className={`${fieldClass} mt-3`}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (step === "signup") setStep("email");
                  }}
                  placeholder="you@example.com"
                />

                {step === "signup" ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        aria-label="First name"
                        required
                        autoComplete="given-name"
                        className={fieldClass}
                        value={firstName}
                        maxLength={50}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First name"
                      />
                      <input
                        aria-label="Last name"
                        required
                        autoComplete="family-name"
                        className={fieldClass}
                        value={lastName}
                        maxLength={50}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                    {teamsEnabled ? (
                      <div>
                        <input
                          aria-label="Team name (optional)"
                          className={fieldClass}
                          list="aad-teams"
                          value={team}
                          maxLength={50}
                          onChange={(event) => setTeam(event.target.value)}
                          placeholder="Team name (optional)"
                        />
                        <datalist id="aad-teams">
                          {(teams ?? []).map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        <p className="mt-1 text-xs text-slate-500">
                          Adopting with a group? Join an existing team or start one. The City may reject inappropriate
                          names.
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        City of Champaign Waiver of Liability (
                        <a href={CITY_WAIVER_URL} target="_blank" rel="noreferrer" className="underline">
                          open the City&apos;s copy <ExternalLink className="inline h-3 w-3" />
                        </a>
                        )
                      </p>
                      <div className="mt-1 max-h-56 overflow-y-auto rounded-[4px] border border-[var(--color-border)] bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                        <p className="font-bold">{WAIVER_TITLE}</p>
                        {WAIVER_PARAGRAPHS.map((paragraph, index) => (
                          <p key={index} className={`mt-2 ${paragraph.strong ? "font-semibold" : ""}`}>
                            {paragraph.text}
                          </p>
                        ))}
                      </div>
                      <label className="mt-2 flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={accepted}
                          onChange={(event) => setAccepted(event.target.checked)}
                        />
                        <span>I&apos;m 18 or older, and I have read and accept the City&apos;s Waiver of Liability.</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    By signing in, you agree to the City&apos;s{" "}
                    <a href={CITY_WAIVER_URL} target="_blank" rel="noreferrer" className="underline">
                      Waiver of Liability
                    </a>
                    .
                  </p>
                )}

                <TurnstileBox widgetRef={turnstileId} />
                {formError ? <p className="mt-2 text-sm text-red-700">{formError}</p> : null}
                <div className="mt-3 flex items-center gap-3">
                  <button type="submit" className={primaryButton} disabled={sending || !email}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {step === "signup" ? "Sign up" : "Email me a link"}
                  </button>
                  {step === "signup" ? (
                    <button type="button" className="text-sm underline" onClick={() => setStep("email")}>
                      Back
                    </button>
                  ) : null}
                </div>
                {selected && selected[3] === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Your link will bring you back to {selectedTitle} so you can adopt it.
                  </p>
                ) : null}
              </form>
            )}
          </div>
          ) : null}
        </aside>
      </div>

      <details className="group mt-8 max-w-3xl text-sm leading-relaxed text-slate-700">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-[var(--color-primary)]">
          <Info className="h-4 w-4" /> More info
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            Adopters keep their drain&apos;s grate clear of leaves and trash, at least four times a year and before big
            storms. Clear only what&apos;s on top of the grate, and watch for traffic.
          </p>
          <p>
            The City of Champaign runs the program; Abundant CU isn&apos;t affiliated with it. Sign-ups, emails, and
            adoptions go straight to the City&apos;s system. We don&apos;t keep your email or name.
          </p>
        </div>
      </details>
    </section>
  );
}
