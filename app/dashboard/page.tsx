"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import { useNotifications } from "../../src/components/notifications/NotificationProvider";
import {
  listDirectoryUsersWithUsage,
  listVoluntaryReviews,
  requestUserFeedback,
  type DirectoryUserUsage,
  type VoluntaryReviewDoc
} from "../../src/lib/repos/adminRepo";
import {
  getAdminStatsSummary,
  listAdminStatsMonthly,
  type AdminStatsMonthly,
  type AdminStatsSummary
} from "../../src/lib/repos/adminStatsRepo";
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
  const { notifySuccess, notifyError } = useNotifications();
  const isAdmin = userDoc?.role === "admin";
  const currency = userDoc?.preferredCurrency || "USD";

  const [summary, setSummary] = useState<AdminStatsSummary | null>(null);
  const [monthly, setMonthly] = useState<AdminStatsMonthly[]>([]);
  const [users, setUsers] = useState<DirectoryUserUsage[]>([]);
  const [reviews, setReviews] = useState<VoluntaryReviewDoc[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingReviewForId, setRequestingReviewForId] = useState<string | null>(null);
  const [appUsageModalOpen, setAppUsageModalOpen] = useState(false);
  const usersPageSize = 20;

  const userById = useMemo(() => {
    const m = new Map<string, DirectoryUserUsage>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const totalUserPages = Math.max(1, Math.ceil(users.length / usersPageSize));
  const pagedUsers = useMemo(() => {
    const safePage = Math.min(usersPage, totalUserPages);
    const start = (safePage - 1) * usersPageSize;
    return users.slice(start, start + usersPageSize);
  }, [users, usersPage, totalUserPages]);

  async function refresh() {
    if (!isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const [statsSummary, statsMonthly, usageRows, reviewRows] = await Promise.all([
        getAdminStatsSummary(),
        listAdminStatsMonthly(6),
        listDirectoryUsersWithUsage(),
        listVoluntaryReviews()
      ]);
      setSummary(statsSummary);
      setMonthly(statsMonthly);
      setUsers(usageRows);
      setReviews(reviewRows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    setUsersPage(1);
  }, [users.length]);

  useEffect(() => {
    if (usersPage > totalUserPages) setUsersPage(totalUserPages);
  }, [usersPage, totalUserPages]);

  async function onRequestReview(target: DirectoryUserUsage) {
    if (!user?.uid) {
      notifyError("You must be signed in to send a request.");
      return;
    }
    setRequestingReviewForId(target.id);
    try {
      await requestUserFeedback(user.uid, target);
      notifySuccess(`Feedback request sent to ${target.email || target.id}. They will see it in the app as a notification.`);
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequestingReviewForId(null);
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
      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
        Admin access required. Ask an existing admin to set your user document role to <code>admin</code>.
      </div>
    );
  }

  return (
    <div className="flex h-0 min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      {error ? (
        <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="et-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <h3 className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">User feedback</h3>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch] dark:border-white/10">
          {!reviews.length ? (
            <div className="p-3 text-sm text-slate-600 dark:text-slate-300">{busy ? "Loading feedback..." : "No feedback submitted yet."}</div>
          ) : (
            <table className="w-full min-w-[36rem] text-xs sm:text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Email</th>
                  <th className="px-2 py-1.5 font-semibold">Display name</th>
                  <th className="px-2 py-1.5 font-semibold">Rating</th>
                  <th className="px-2 py-1.5 font-semibold">Comment</th>
                  <th className="px-2 py-1.5 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => {
                  const u = userById.get(r.userId);
                  const email = u?.email || "—";
                  const displayName = u?.displayName || "—";
                  const commentPreview =
                    r.comment.length > 160 ? `${r.comment.slice(0, 157)}…` : r.comment || "—";
                  return (
                    <tr key={r.userId} className="border-t border-slate-200 dark:border-white/10">
                      <td className="max-w-[12rem] truncate px-2 py-1.5" title={email !== "—" ? email : undefined}>
                        {email}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-1.5" title={displayName !== "—" ? displayName : undefined}>
                        {displayName}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{r.rating} / 5</td>
                      <td className="max-w-[min(28rem,40vw)] px-2 py-1.5 text-slate-700 dark:text-slate-200" title={r.comment || undefined}>
                        <span className="line-clamp-2 whitespace-pre-wrap break-words">{commentPreview}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">
                        {r.updatedAt ? formatDateTime(r.updatedAt) : r.createdAt ? formatDateTime(r.createdAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="et-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Users and activity</h3>
          <button
            type="button"
            className="et-btn-secondary !min-h-9 shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold sm:text-sm"
            onClick={() => setAppUsageModalOpen(true)}
          >
            App usage
          </button>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
          {!users.length ? (
            <div className="p-3 text-sm text-slate-600 dark:text-slate-300">{busy ? "Loading users..." : "No users found."}</div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[52rem] text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Email</th>
                      <th className="px-2 py-1.5 font-semibold">Display name</th>
                      <th className="px-2 py-1.5 font-semibold">Role</th>
                      <th className="px-2 py-1.5 font-semibold">Total entries</th>
                      <th className="px-2 py-1.5 font-semibold">Last 30 days</th>
                      <th className="px-2 py-1.5 font-semibold">Last entry</th>
                      <th className="px-2 py-1.5 font-semibold">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 dark:border-white/10">
                        <td className="px-2 py-1.5">{row.email}</td>
                        <td className="px-2 py-1.5">{row.displayName || "-"}</td>
                        <td className="px-2 py-1.5">{row.role || "user"}</td>
                        <td className="px-2 py-1.5">{row.totalEntries}</td>
                        <td className="px-2 py-1.5">{row.entriesLast30Days}</td>
                        <td className="px-2 py-1.5">{row.lastEntryAt ? formatDateTime(row.lastEntryAt) : "-"}</td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <button
                            type="button"
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/25 sm:text-xs"
                            disabled={Boolean(requestingReviewForId) || busy}
                            aria-busy={requestingReviewForId === row.id}
                            onClick={() => void onRequestReview(row)}
                          >
                            {requestingReviewForId === row.id ? "Sending…" : "Request review"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex shrink-0 items-center justify-between border-t border-slate-200 pt-2 text-xs dark:border-white/10 sm:text-sm">
                <div className="text-slate-600 dark:text-slate-300">
                  Page {Math.min(usersPage, totalUserPages)} of {totalUserPages}
                </div>
                <div className="flex items-center gap-2">
                  {usersPage > 1 ? (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10 sm:text-sm"
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                  ) : null}
                  {usersPage < totalUserPages ? (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/10 sm:text-sm"
                      onClick={() => setUsersPage((p) => Math.min(totalUserPages, p + 1))}
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {appUsageModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3"
          role="presentation"
          onClick={() => setAppUsageModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-usage-dialog-title"
            className="et-card flex max-h-[min(88dvh,720px)] w-full max-w-3xl flex-col overflow-hidden !p-0 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
              <h2 id="app-usage-dialog-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                App usage
              </h2>
              <button
                type="button"
                className="et-btn-secondary !min-h-9 px-3 py-1.5 text-xs font-semibold sm:text-sm"
                onClick={() => setAppUsageModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
              {!summary ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No aggregate stats yet. Populate Firestore docs under <code>adminStats/summary</code> and{" "}
                  <code>adminStats/monthly/rows</code> to enable these cards.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricCard label="Registered accounts" value={String(summary.totalUsers)} />
                  <MetricCard label="Entries logged (all time)" value={String(summary.totalTransactions)} />
                  <MetricCard label="Expense volume (total)" value={formatMoney(summary.totalExpenseAmount, currency)} />
                  <MetricCard label="Income volume (total)" value={formatMoney(summary.totalIncomeAmount, currency)} />
                </div>
              )}
              {monthly.length ? (
                <div className="mt-4 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
                  <table className="w-full min-w-[28rem] text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Month</th>
                        <th className="px-2 py-1.5 font-semibold">New sign-ups</th>
                        <th className="px-2 py-1.5 font-semibold">Entries</th>
                        <th className="px-2 py-1.5 font-semibold">Expense volume</th>
                        <th className="px-2 py-1.5 font-semibold">Income volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200 dark:border-white/10">
                          <td className="px-2 py-1.5">{row.monthKey}</td>
                          <td className="px-2 py-1.5">{row.newUsers}</td>
                          <td className="px-2 py-1.5">{row.transactions}</td>
                          <td className="px-2 py-1.5">{formatMoney(row.expenseAmount, currency)}</td>
                          <td className="px-2 py-1.5">{formatMoney(row.incomeAmount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value || 0));
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
      <div className="text-[0.7rem] uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 sm:text-base">{value}</div>
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
