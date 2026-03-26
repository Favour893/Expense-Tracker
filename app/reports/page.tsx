"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import type { Category, Transaction } from "../../src/types/app";
import { listCategories } from "../../src/lib/repos/categoriesRepo";
import { listTransactionsByMonth } from "../../src/lib/repos/entriesRepo";
import { computeMonthlyReport, renderNarrative, shiftMonthKey } from "../../src/lib/reporting/reportModel";
import { ReportPreview } from "../../src/components/reports/ReportPreview";
import { ExportPdfButton } from "../../src/components/reports/ExportPdfButton";

function currentMonthKey() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <Reports />
    </RequireAuth>
  );
}

function Reports() {
  const { user, profile } = useAuth();
  const uid = user?.uid;

  const currency = profile?.currency || "USD";

  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState<Transaction[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useMemo(() => {
    if (!categories) return null;
    return computeMonthlyReport({
      transactions,
      categories,
      monthKey,
      lastMonthTransactions
    });
  }, [categories, lastMonthTransactions, monthKey, transactions]);

  const narrativeText = useMemo(() => {
    if (!report) return "";
    const hasLastMonth = lastMonthTransactions.length > 0;
    return renderNarrative({
      report,
      currency,
      monthKey,
      hasLastMonth,
      locale: "en-US"
    });
  }, [currency, lastMonthTransactions.length, monthKey, report]);

  async function loadAll(mk: string) {
    if (!uid) return;
    setBusy(true);
    setError(null);
    try {
      const [cats, txs] = await Promise.all([listCategories(uid), listTransactionsByMonth(uid, mk)]);
      setCategories(cats);
      setTransactions(txs);

      const lastMk = shiftMonthKey(mk, -1);
      let lastTxs: Transaction[] = [];
      if (lastMk) {
        try {
          lastTxs = await listTransactionsByMonth(uid, lastMk);
        } catch {
          lastTxs = [];
        }
      }
      setLastMonthTransactions(lastTxs);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!uid) return;
    loadAll(monthKey).catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, monthKey]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-2xl font-bold text-transparent">Monthly Reports</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Preview in the browser first, then export the same report as a PDF.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Month
            <input className="et-input mt-1 w-full sm:w-auto" type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
          </label>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-3 sm:flex-row sm:items-center dark:border-white/10 dark:from-white/5 dark:to-white/5">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {busy ? "Loading report..." : "Report ready."}
        </div>
        <ExportPdfButton monthKey={monthKey} currency={currency} />
      </div>

      {report ? <ReportPreview report={report} monthKey={monthKey} currency={currency} narrativeText={narrativeText} /> : null}
    </div>
  );
}

