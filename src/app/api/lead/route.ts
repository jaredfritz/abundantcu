import { NextResponse } from "next/server";
import { submitLead } from "@/lib/leads/submitLead";
import { LeadSubmission } from "@/lib/leads/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      curbanismOptIn?: boolean;
      sourcePage?: string;
      honeypot?: string;
    };

    if (body.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const email = body.email?.trim() ?? "";
    const sourcePage = body.sourcePage?.trim() ?? "unknown";

    const payload: LeadSubmission = {
      email,
      curbanismOptIn: Boolean(body.curbanismOptIn),
      sourcePage,
      submittedAt: new Date().toISOString(),
    };

    await submitLead(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
