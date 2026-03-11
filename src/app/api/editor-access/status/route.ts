import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "@/lib/supabase/serverAuth";
import { isApprovedEditor } from "@/lib/editors/repository";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

export async function GET(request: Request) {
  try {
    const ip = getRequestIp(request);
    const limit = await rateLimit({ bucket: "editor-status", identifier: ip, limit: 120, windowSec: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { allowed: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ allowed: false, requiresAuth: true });
    }

    const allowed = await isApprovedEditor(user);
    return NextResponse.json({ allowed });
  } catch (error) {
    console.error("editor status check failed", error);
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
