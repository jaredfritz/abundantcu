import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appUrlFor, CityServiceError, isPlausibleToken, normalizeUserId, validateUser } from "./adoptADrain.server";
import { getRequestIp, rateLimit } from "./security/rateLimit";

/** Origins whose /adopt-a-drain page the City's sign-in emails may link to. */
const ALLOWED_ORIGINS = [
  "https://abundantcu.com",
  "https://www.abundantcu.com",
  "http://localhost:3000",
  "http://localhost:3001",
];
const PRODUCTION_ORIGIN = "https://abundantcu.com";

const COOKIE = "aad_session";
/** The City's sign-in tokens last 24 hours (AuthGP's 1440-minute token age). */
const COOKIE_MAX_AGE = 24 * 60 * 60;

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * The page origin for a state-changing request, or null if the request didn't come from this site. In development
 * a missing Origin header (curl, tests) is allowed and treated as the production origin.
 */
export function checkedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  if (!origin && process.env.NODE_ENV !== "production") return PRODUCTION_ORIGIN;
  return null;
}

/** The origin the City's sign-in links should point back to for this request. */
export function pageOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  const own = new URL(request.url).origin;
  return ALLOWED_ORIGINS.includes(own) ? own : PRODUCTION_ORIGIN;
}

export async function limitOrReject(request: Request, bucket: string, limit: number, windowSec: number, id?: string) {
  const result = await rateLimit({ bucket, identifier: id ?? getRequestIp(request), limit, windowSec });
  if (result.allowed) return null;
  return json({ error: "Too many requests. Please try again shortly." }, 429, {
    "Retry-After": String(result.retryAfterSec),
  });
}

export function cityError(err: unknown) {
  console.error("[adopt-a-drain]", err);
  const message =
    err instanceof CityServiceError
      ? "The City's Adopt-a-Drain system didn't respond as expected. Please try again in a few minutes."
      : "Something went wrong. Please try again.";
  return json({ error: message }, 502);
}

interface StoredSession {
  userId: string;
  token: string;
}

export async function setSession(userId: string, token: string) {
  const store = await cookies();
  store.set(COOKIE, Buffer.from(JSON.stringify({ u: userId, t: token })).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/adopt-a-drain",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/api/adopt-a-drain", maxAge: 0 });
}

async function readSession(): Promise<StoredSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { u?: unknown; t?: unknown };
    const userId = normalizeUserId(parsed.u);
    if (!userId || !isPlausibleToken(parsed.t)) return null;
    return { userId, token: parsed.t };
  } catch {
    return null;
  }
}

export type CurrentUser =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; expired: boolean; signedOut: boolean };

/**
 * The signed-in user, checked with the City each time. The token in the cookie is the one from the City's emailed
 * link, so nothing here trusts the browser's word for who someone is.
 */
export async function currentUser(origin: string): Promise<CurrentUser> {
  const session = await readSession();
  if (!session) return { ok: false, expired: false, signedOut: true };
  const outcome = await validateUser(session.userId, session.token, appUrlFor(origin));
  if (!outcome.ok) {
    await clearSession();
    return { ok: false, expired: outcome.expired, signedOut: false };
  }
  return { ok: true, userId: session.userId, email: outcome.email };
}
