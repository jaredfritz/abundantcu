import { appUrlFor, cleanText, isPlausibleEmail, requestLoginEmail, signUp } from "@/lib/adoptADrain.server";
import { checkedOrigin, cityError, json, limitOrReject } from "@/lib/adoptADrainHttp.server";
import { getRequestIp } from "@/lib/security/rateLimit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

interface EmailRequest {
  email?: unknown;
  mode?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  team?: unknown;
  acceptedWaiver?: unknown;
  adoptId?: unknown;
  turnstileToken?: unknown;
  honeypot?: unknown;
}

/**
 * Ask the City to email a sign-in link (returning volunteers) or a sign-up confirmation (new volunteers, who must
 * accept the City's waiver first). The email comes from the City and links back to this site's /adopt-a-drain page.
 */
export async function POST(request: Request) {
  const origin = checkedOrigin(request);
  if (!origin) return json({ error: "Forbidden" }, 403);

  const limited = await limitOrReject(request, "aad-email-ip", 8, 600);
  if (limited) return limited;

  let body: EmailRequest;
  try {
    body = (await request.json()) as EmailRequest;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (body.honeypot) return json({ status: "sent" });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!isPlausibleEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  const mode = body.mode === "signup" ? "signup" : "login";
  const adoptId = typeof body.adoptId === "number" && Number.isInteger(body.adoptId) && body.adoptId > 0
    ? body.adoptId
    : undefined;

  const emailLimited = await limitOrReject(request, "aad-email-address", 3, 3600, email.toLowerCase());
  if (emailLimited) {
    return json({ error: "We've already asked the City to email that address a few times. Check your inbox, or try again in an hour." }, 429);
  }

  const turnstileOk = await verifyTurnstileToken(
    typeof body.turnstileToken === "string" ? body.turnstileToken : "",
    getRequestIp(request)
  );
  if (!turnstileOk) return json({ error: "Please complete the verification challenge." }, 400);

  const appUrl = appUrlFor(origin);
  try {
    if (mode === "login") {
      const outcome = await requestLoginEmail(email, appUrl, adoptId);
      return json({ status: outcome });
    }

    if (body.acceptedWaiver !== true) {
      return json({ error: "You need to accept the City's Waiver of Liability to sign up." }, 400);
    }
    const firstName = cleanText(body.firstName, 50);
    const lastName = cleanText(body.lastName, 50);
    if (!firstName || !lastName) return json({ error: "Enter your first and last name." }, 400);
    const team = cleanText(body.team, 50) || undefined;
    await signUp(email, { firstName, lastName, team }, appUrl, adoptId);
    return json({ status: "sent" });
  } catch (err) {
    return cityError(err);
  }
}
