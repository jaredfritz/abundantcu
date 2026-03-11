import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EditorAccessRequestRow, EditorRoleRow } from "@/lib/editors/types";

export function isValidAdminToken(token: string | null): boolean {
  const configured = process.env.EDITOR_ADMIN_TOKEN;
  if (!configured) return false;
  return Boolean(token && token === configured);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isApprovedEditor(user: Pick<User, "id" | "email">): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const email = normalizeEmail(user.email ?? "");

  const { data, error } = await admin
    .from("editor_roles" as never)
    .select("id")
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .limit(1);

  if (error) {
    console.error("editor role lookup failed", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

export async function createEditorAccessRequest(input: {
  email: string;
  displayName: string;
  notes?: string;
  requesterUserId?: string;
}): Promise<{ request: EditorAccessRequestRow; created: boolean }> {
  const admin = getSupabaseAdminClient();
  const email = normalizeEmail(input.email);

  const { data: existing, error: existingError } = await admin
    .from("editor_access_requests" as never)
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EditorAccessRequestRow>();

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error("Could not check existing access requests.");
  }

  if (existing) {
    return { request: existing, created: false };
  }

  const payload = {
    email,
    display_name: input.displayName.trim(),
    notes: input.notes?.trim() || null,
    requester_user_id: input.requesterUserId ?? null,
    status: "pending",
  };

  const { data, error } = await admin
    .from("editor_access_requests" as never)
    .insert(payload as never)
    .select("*")
    .single<EditorAccessRequestRow>();

  if (error || !data) {
    throw new Error("Could not submit access request.");
  }

  return { request: data, created: true };
}

export async function listEditorsAndRequests(): Promise<{
  editors: EditorRoleRow[];
  requests: EditorAccessRequestRow[];
}> {
  const admin = getSupabaseAdminClient();

  const [{ data: editors, error: editorsError }, { data: requests, error: requestsError }] = await Promise.all([
    admin
      .from("editor_roles" as never)
      .select("*")
      .order("granted_at", { ascending: false }),
    admin
      .from("editor_access_requests" as never)
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (editorsError || requestsError) {
    throw new Error("Could not load editor data.");
  }

  return {
    editors: (editors ?? []) as EditorRoleRow[],
    requests: (requests ?? []) as EditorAccessRequestRow[],
  };
}

export async function approveEditorRequest(requestId: string, reviewer: string): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: request, error: requestError } = await admin
    .from("editor_access_requests" as never)
    .select("*")
    .eq("id", requestId)
    .single<EditorAccessRequestRow>();

  if (requestError || !request) {
    throw new Error("Request not found.");
  }

  const roleInsert = {
    email: normalizeEmail(request.email),
    user_id: request.requester_user_id,
    granted_by: reviewer,
  };

  const { error: roleError } = await admin
    .from("editor_roles" as never)
    .upsert(roleInsert as never, { onConflict: "email" });

  if (roleError) {
    throw new Error("Could not grant editor role.");
  }

  const { error: requestUpdateError } = await admin
    .from("editor_access_requests" as never)
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewer } as never)
    .eq("id", requestId);

  if (requestUpdateError) {
    throw new Error("Could not update request status.");
  }
}

export async function rejectEditorRequest(requestId: string, reviewer: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("editor_access_requests" as never)
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewer } as never)
    .eq("id", requestId);

  if (error) {
    throw new Error("Could not reject request.");
  }
}

export async function revokeEditorRole(roleId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("editor_roles" as never).delete().eq("id", roleId);
  if (error) {
    throw new Error("Could not revoke editor role.");
  }
}
