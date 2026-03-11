import { NextResponse } from "next/server";
import {
  approveEditorRequest,
  isValidAdminToken,
  listEditorsAndRequests,
  rejectEditorRequest,
  revokeEditorRole,
} from "@/lib/editors/repository";
import { getRequestIp, rateLimit } from "@/lib/security/rateLimit";

function readToken(request: Request): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) return headerToken;

  return null;
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const ip = getRequestIp(request);
    const limit = await rateLimit({ bucket: "admin-editors", identifier: ip, limit: 120, windowSec: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const token = readToken(request);
    if (!isValidAdminToken(token)) return forbidden();

    const data = await listEditorsAndRequests();
    return NextResponse.json(data);
  } catch (error) {
    console.error("admin editors GET failed", error);
    return NextResponse.json({ error: "Unable to load editor data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const limit = await rateLimit({ bucket: "admin-editor-actions", identifier: ip, limit: 90, windowSec: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = (await request.json()) as {
      token?: string;
      action?: "approve" | "reject" | "revoke";
      requestId?: string;
      roleId?: string;
      reviewer?: string;
    };

    const token = body.token ?? readToken(request);
    if (!isValidAdminToken(token)) return forbidden();

    const reviewer = body.reviewer?.trim() || "admin";

    if (body.action === "approve") {
      if (!body.requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
      await approveEditorRequest(body.requestId, reviewer);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reject") {
      if (!body.requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
      await rejectEditorRequest(body.requestId, reviewer);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "revoke") {
      if (!body.roleId) return NextResponse.json({ error: "Missing roleId" }, { status: 400 });
      await revokeEditorRole(body.roleId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("admin editors POST failed", error);
    return NextResponse.json({ error: "Unable to apply admin action." }, { status: 500 });
  }
}
