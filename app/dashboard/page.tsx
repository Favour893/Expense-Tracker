"use client";

import React, { useEffect, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import { createReviewRequest, listDirectoryUsers, type DirectoryUser } from "../../src/lib/repos/adminRepo";
import { PageLoadingShimmer } from "../../src/components/ui/PageLoadingShimmer";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const { user, userDoc, loading } = useAuth();
  const uid = user?.uid;
  const isAdmin = userDoc?.role === "admin";

  const [rows, setRows] = useState<DirectoryUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!uid || !isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      setRows(await listDirectoryUsers());
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isAdmin]);

  async function onRequestReview(target: DirectoryUser) {
    if (!uid) return;
    setMessage(null);
    setError(null);
    try {
      await createReviewRequest(uid, target);
      setMessage(`Review request created for ${target.email}.`);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  if (loading) {
    return (
      <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
        <PageLoadingShimmer label="Loading dashboard" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
        Admin access required. Ask an existing admin to set your user document role to <code>admin</code>.
      </div>
    );
  }

  return (
    <div className="flex h-0 min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <section className="et-card shrink-0">
        <h2 className="text-xl font-semibold">Admin dashboard</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">View users and create review requests.</p>
      </section>

      <section className="et-card flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Users</h3>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => refresh()}
            disabled={busy}
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? <div className="mb-2 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="mb-2 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
          {!rows.length ? (
            <div className="p-4 text-sm text-slate-600 dark:text-slate-300">{busy ? "Loading users..." : "No users found."}</div>
          ) : (
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Display name</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-white/10">
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.displayName || "-"}</td>
                    <td className="px-3 py-2">{row.role || "user"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        onClick={() => onRequestReview(row)}
                      >
                        Request review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
