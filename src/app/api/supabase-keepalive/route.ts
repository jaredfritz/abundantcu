import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KeepaliveResult = {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function pingSupabaseTarget(name: string, url: string, anonKey: string): Promise<KeepaliveResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    return {
      name,
      url,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const baseUrl = normalizeBaseUrl(supabaseUrl);
  const startedAt = Date.now();

  const results = await Promise.all([
    pingSupabaseTarget("auth-settings", `${baseUrl}/auth/v1/settings`, anonKey),
    pingSupabaseTarget("rest-root", `${baseUrl}/rest/v1/`, anonKey),
  ]);

  const ok = results.some((result) => result.ok);

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      results,
    },
    {
      status: ok ? 200 : 502,
      headers: { "cache-control": "no-store" },
    }
  );
}
