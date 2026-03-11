interface TurnstileVerifyResult {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Allow local development when Turnstile is not configured.
    return process.env.NODE_ENV !== "production";
  }

  if (!token) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) return false;
  const data = (await res.json()) as TurnstileVerifyResult;
  return Boolean(data.success);
}
