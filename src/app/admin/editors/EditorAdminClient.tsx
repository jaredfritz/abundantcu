"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EditorAccessRequestRow, EditorRoleRow } from "@/lib/editors/types";

interface AdminPayload {
  editors: EditorRoleRow[];
  requests: EditorAccessRequestRow[];
}

async function parseError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || `Request failed (${res.status})`;
}

export default function EditorAdminClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminPayload>({ editors: [], requests: [] });
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const pending = useMemo(
    () => data.requests.filter((request) => request.status === "pending"),
    [data.requests]
  );

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Missing admin token.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch(`/api/admin/editors?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) {
      setError(await parseError(res));
      setLoading(false);
      return;
    }

    const payload = (await res.json()) as AdminPayload;
    setData(payload);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: "approve" | "reject" | "revoke", id: string) {
    if (!token) return;
    const busyKey = `${action}:${id}`;
    setActionBusy(busyKey);
    setError("");

    const body =
      action === "revoke"
        ? { token, action, roleId: id, reviewer: "Jared Fritz" }
        : { token, action, requestId: id, reviewer: "Jared Fritz" };

    const res = await fetch("/api/admin/editors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError(await parseError(res));
      setActionBusy(null);
      return;
    }

    await load();
    setActionBusy(null);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">Editor Access Admin</h1>
      <p className="mt-2 text-sm text-slate-700 md:text-base">
        Review pending editor access requests and manage approved editors.
      </p>

      {loading ? <p className="mt-6 text-sm text-slate-600">Loading...</p> : null}
      {error ? <p className="mt-6 rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && !error && (
        <>
          <section className="mt-8 rounded-[4px] border border-[var(--color-border)] bg-white p-5">
            <h2 className="text-xl font-bold">Pending Requests ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No pending requests.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pending.map((request) => (
                  <li key={request.id} className="rounded-[4px] border border-[var(--color-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-primary)]">{request.display_name}</p>
                        <p className="text-xs text-slate-600">{request.email}</p>
                        <p className="mt-2 text-sm text-slate-700">{request.notes || "No notes provided."}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Requested {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionBusy === `approve:${request.id}`}
                          onClick={() => runAction("approve", request.id)}
                          className="rounded-[4px] bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy === `reject:${request.id}`}
                          onClick={() => runAction("reject", request.id)}
                          className="rounded-[4px] border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 rounded-[4px] border border-[var(--color-border)] bg-white p-5">
            <h2 className="text-xl font-bold">Approved Editors ({data.editors.length})</h2>
            {data.editors.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No approved editors yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.editors.map((editor) => (
                  <li key={editor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--color-border)] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-primary)]">{editor.email}</p>
                      <p className="text-xs text-slate-600">
                        Granted {new Date(editor.granted_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actionBusy === `revoke:${editor.id}`}
                      onClick={() => runAction("revoke", editor.id)}
                      className="rounded-[4px] border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
