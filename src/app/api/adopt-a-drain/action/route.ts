import type { DrainAction } from "@/lib/adoptADrain";
import { applyDrainAction, DrainActionError } from "@/lib/adoptADrain.server";
import { checkedOrigin, cityError, currentUser, json, limitOrReject } from "@/lib/adoptADrainHttp.server";

const ACTIONS: DrainAction[] = ["adopt", "release", "clean", "rename"];

/** Adopt, release, rename, or mark cleaned one drain, for the signed-in volunteer. */
export async function POST(request: Request) {
  const origin = checkedOrigin(request);
  if (!origin) return json({ error: "Forbidden" }, 403);
  const limited = await limitOrReject(request, "aad-action-ip", 60, 600);
  if (limited) return limited;

  let body: { id?: unknown; action?: unknown; nickname?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const id = typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0 ? body.id : null;
  const action = ACTIONS.find((candidate) => candidate === body.action);
  if (!id || !action) return json({ error: "Invalid request." }, 400);

  try {
    const user = await currentUser(origin);
    if (!user.ok) {
      return json(
        user.expired
          ? { error: "Your sign-in expired. The City just emailed you a new link.", signedOut: true }
          : { error: "Sign in to adopt drains.", signedOut: true },
        401
      );
    }
    const userLimited = await limitOrReject(request, "aad-action-user", 40, 600, user.userId);
    if (userLimited) return userLimited;

    const drain = await applyDrainAction(user.userId, id, action, body.nickname);
    return json({ ok: true, drain });
  } catch (err) {
    if (err instanceof DrainActionError) return json({ error: err.message }, err.status);
    return cityError(err);
  }
}
