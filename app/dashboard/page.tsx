"use client";

import React, { useEffect, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
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
  const { userDoc, loading } = useAuth();
  const isAdmin = userDoc?.role === "admin";
  const currency = userDoc?.preferredCurrency || "USD";

  const [summary, setSummary] = useState<AdminStatsSummary | null>(null);
  const [monthly, setMonthly] = useState<AdminStatsMonthly[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const [statsSummary, statsMonthly] = await Promise.all([getAdminStatsSummary(), listAdminStatsMonthly(6)]);
      setSummary(statsSummary);
      setMonthly(statsMonthly);
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Admin dashboard</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Aggregate usage of the app — no individual accounts are listed here.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => refresh()}
            disabled={busy}
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="et-card flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">App usage</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Totals come from aggregate docs under <code className="text-[0.7rem]">adminStats</code> (maintained outside the client).
        </p>

        {error ? (
          <div className="mt-2 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        {!summary ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No aggregate stats yet. Populate Firestore docs under <code>adminStats/summary</code> and{" "}
            <code>adminStats/monthly/rows</code> to enable these cards.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Registered accounts" value={String(summary.totalUsers)} />
            <MetricCard label="Entries logged (all time)" value={String(summary.totalTransactions)} />
            <MetricCard label="Expense volume (total)" value={formatMoney(summary.totalExpenseAmount, currency)} />
            <MetricCard label="Income volume (total)" value={formatMoney(summary.totalIncomeAmount, currency)} />
          </div>
        )}

        {monthly.length ? (
          <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full min-w-[28rem] text-xs sm:text-sm">
              <thead className="bg-slate-50 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 font-semibold">Month</th>
                  <th className="px-3 py-2 font-semibold">New sign-ups</th>
                  <th className="px-3 py-2 font-semibold">Entries</th>
                  <th className="px-3 py-2 font-semibold">Expense volume</th>
                  <th className="px-3 py-2 font-semibold">Income volume</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-white/10">
                    <td className="px-3 py-2">{row.monthKey}</td>
                    <td className="px-3 py-2">{row.newUsers}</td>
                    <td className="px-3 py-2">{row.transactions}</td>
                    <td className="px-3 py-2">{formatMoney(row.expenseAmount, currency)}</td>
                    <td className="px-3 py-2">{formatMoney(row.incomeAmount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
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
