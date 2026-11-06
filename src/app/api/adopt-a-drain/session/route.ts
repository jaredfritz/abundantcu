import type { SessionResponse } from "@/lib/adoptADrain";
import { appUrlFor, fetchMyDrains, isPlausibleToken, normalizeUserId, validateUser } from "@/lib/adoptADrain.server";
import {
  checkedOrigin,
  cityError,
  clearSession,
  currentUser,
  json,
  limitOrReject,
  pageOrigin,
  setSession,
} from "@/lib/adoptADrainHttp.server";

/** Who's signed in (checked with the City) and the drains they've adopted. */
export async function GET(request: Request) {
  const limited = await limitOrReject(request, "aad-session-ip", 60, 600);
  if (limited) return limited;
  try {
    const user = await currentUser(pageOrigin(request));
    if (!user.ok) return json({ signedIn: false, expired: user.expired } satisfies SessionResponse & { expired: boolean });
    const body: SessionResponse = { signedIn: true, email: user.email, myDrains: await fetchMyDrains(user.userId) };
    return json(body);
  } catch (err) {
    return cityError(err);
  }
}

/** Sign in with the user ID and token from the City's emailed link. */
export async function POST(request: Request) {
  const origin = checkedOrigin(request);
  if (!origin) return json({ error: "Forbidden" }, 403);
  const limited = await limitOrReject(request, "aad-signin-ip", 20, 600);
  if (limited) return limited;

  let body: { userid?: unknown; usertoken?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const userId = normalizeUserId(body.userid);
  if (!userId || !isPlausibleToken(body.usertoken)) {
    return json({ error: "That sign-in link isn't complete. Try the link in your email again." }, 400);
  }

  try {
    const outcome = await validateUser(userId, body.usertoken, appUrlFor(origin));
    if (!outcome.ok) {
      await clearSession();
      return json(
        outcome.expired
          ? { error: "That link has expired. The City just emailed you a new one.", expired: true }
          : { error: "That sign-in link isn't valid. Enter your email to get a new one." },
        401
      );
    }
    await setSession(userId, body.usertoken);
    const response: SessionResponse = { signedIn: true, email: outcome.email, myDrains: await fetchMyDrains(userId) };
    return json(response);
  } catch (err) {
    return cityError(err);
  }
}

/** Sign out of this site. (City sign-in links keep working until they expire.) */
export async function DELETE(request: Request) {
  if (!checkedOrigin(request)) return json({ error: "Forbidden" }, 403);
  await clearSession();
  return json({ signedIn: false });
}
