"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import type { Category, Transaction } from "../../src/types/app";
import { listCategories } from "../../src/lib/repos/categoriesRepo";
import { listTransactionsByDateRange } from "../../src/lib/repos/entriesRepo";
import {
  computeMonthlyReport,
  computeTop3ExpensePercentSumRounded1,
  formatReportDateRangeLabel,
  previousEqualCalendarRange,
  renderNarrative
} from "../../src/lib/reporting/reportModel";
import { ReportPreview } from "../../src/components/reports/ReportPreview";
import { ExportPdfButton } from "../../src/components/reports/ExportPdfButton";
import { PageLoadingShimmer } from "../../src/components/ui/PageLoadingShimmer";
import { formatUkDate } from "../../src/lib/formatDisplayDate";
import { firestoreTimestampMs } from "../../src/lib/firestoreHelpers";
import { CashLogo } from "../../src/components/branding/CashLogo";

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: toIsoLocal(new Date(y, m, 1)),
    end: toIsoLocal(new Date(y, m + 1, 0))
  };
}

/** Newest-first by ledger **date** (matches the Date column), then `createdAt`, then `id`. */
function compareTransactionsNewestFirst(a: Transaction, b: Transaction): number {
  const dateA = firestoreTimestampMs(a.date);
  const dateB = firestoreTimestampMs(b.date);
  if (dateB !== dateA) return dateB - dateA;
  const createdA = firestoreTimestampMs(a.createdAt);
  const createdB = firestoreTimestampMs(b.createdAt);
  if (createdB !== createdA) return createdB - createdA;
  return b.id.localeCompare(a.id);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value || 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <Reports />
    </RequireAuth>
  );
}

function Reports() {
  const { user, profile, userDoc } = useAuth();
  const uid = user?.uid;

  const currency = profile?.currency || userDoc?.preferredCurrency || "USD";
  const displayName = userDoc?.displayName || user?.displayName || user?.email || "User";

  const [rangeStart, setRangeStart] = useState(() => defaultDateRange().start);
  const [rangeEnd, setRangeEnd] = useState(() => defaultDateRange().end);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState<Transaction[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const pageSize = 20;

  const reportMonthKey = rangeStart.slice(0, 7);

  const rangeValid = Boolean(rangeStart && rangeEnd && rangeStart <= rangeEnd);

  const periodLabel = useMemo(() => {
    if (!rangeValid) return "";
    return formatReportDateRangeLabel(rangeStart, rangeEnd, "en-GB");
  }, [rangeEnd, rangeStart, rangeValid]);

  const report = useMemo(() => {
    if (!categories) return null;
    return computeMonthlyReport({
      transactions,
      categories,
      monthKey: reportMonthKey,
      lastMonthTransactions
    });
  }, [categories, lastMonthTransactions, reportMonthKey, transactions]);

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === "expense"),
    [transactions]
  );

  const filteredExpenseTransactions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return expenseTransactions.filter((t) => {
      const categoryName = categoryMap.get(t.categoryId) || "Unknown";
      if (!q) return true;
      const joined = [formatUkDate(t.date), categoryName, String(t.amount || ""), t.description || ""]
        .join(" ")
        .toLowerCase();
      return joined.includes(q);
    });
  }, [categories, expenseTransactions, searchText]);

  const filteredExpenseTotal = useMemo(
    () => filteredExpenseTransactions.reduce((s, t) => s + Number(t.amount || 0), 0),
    [filteredExpenseTransactions]
  );

  const top3PercentSumRoundedFromTable = useMemo(
    () => computeTop3ExpensePercentSumRounded1(filteredExpenseTransactions, categories),
    [filteredExpenseTransactions, categories]
  );

  const narrativeText = useMemo(() => {
    if (!report || !rangeValid) return "";
    const hasLastMonth = lastMonthTransactions.length > 0;
    return renderNarrative({
      report,
      currency,
      monthKey: reportMonthKey,
      periodLabel: periodLabel || undefined,
      hasLastMonth,
      locale: "en-GB",
      top3PercentSumRounded1Override: top3PercentSumRoundedFromTable,
      top3SpendingBasisTotal: filteredExpenseTotal
    });
  }, [
    currency,
    filteredExpenseTotal,
    lastMonthTransactions.length,
    periodLabel,
    report,
    reportMonthKey,
    top3PercentSumRoundedFromTable,
    rangeValid
  ]);

  /** All expense rows in the selected range — included in PDF export (#report-root). */
  const pdfExpenseRows = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const sorted = expenseTransactions.slice().sort(compareTransactionsNewestFirst);
    const total = sorted.reduce((s, t) => s + Number(t.amount || 0), 0);
    return sorted.map((t) => {
      const amount = Number(t.amount || 0);
      return {
        id: t.id,
        date: formatUkDate(t.date),
        category: categoryMap.get(t.categoryId) || "Unknown",
        amount,
        pctOfTotal: total > 0 ? (amount / total) * 100 : 0,
        description: t.description || ""
      };
    });
  }, [categories, expenseTransactions]);

  const tableRows = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const sorted = filteredExpenseTransactions.slice().sort(compareTransactionsNewestFirst);

    const totalExpenseAmount = sorted.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return sorted.map((t) => {
      const amount = Number(t.amount || 0);
      const pctOfTotal =
        totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0;
      return {
        id: t.id,
        date: formatUkDate(t.date),
        category: categoryMap.get(t.categoryId) || "Unknown",
        amount,
        pctOfTotal,
        description: t.description || ""
      };
    });
  }, [categories, filteredExpenseTransactions]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [page, tableRows, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [rangeStart, rangeEnd, searchText]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!narrativeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNarrativeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narrativeOpen]);

  useEffect(() => {
    setNarrativeOpen(false);
  }, [rangeStart, rangeEnd]);

  const exportActionsEnabled = rangeValid && !busy && Boolean(report);

  async function loadAll(startIso: string, endIso: string) {
    if (!uid) return;
    setBusy(true);
    setError(null);
    try {
      const [cats, txs] = await Promise.all([
        listCategories(uid),
        listTransactionsByDateRange(uid, startIso, endIso)
      ]);
      setCategories(cats);
      setTransactions(txs);

      const prev = previousEqualCalendarRange(startIso, endIso);
      let lastTxs: Transaction[] = [];
      if (prev) {
        try {
          lastTxs = await listTransactionsByDateRange(uid, prev.start, prev.end);
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
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setTransactions([]);
      setLastMonthTransactions([]);
      return;
    }
    loadAll(rangeStart, rangeEnd).catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, rangeStart, rangeEnd]);

  return (
    <div className="flex h-0 min-h-0 w-full min-w-0 flex-1 flex-col gap-0.5 overflow-hidden sm:gap-1">
      <div className="shrink-0 flex flex-col gap-0.5 sm:gap-1">
        <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 sm:flex-initial sm:gap-2 sm:text-sm">
                <label className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5 sm:flex-initial">
                  <span className="shrink-0 font-medium">From</span>
                  <input
                    className="et-input min-h-10 min-w-0 flex-1 !px-3 !py-2 text-sm sm:min-w-[9.5rem]"
                    type="date"
                    aria-label="Report date range start"
                    value={rangeStart}
                    max={rangeEnd || undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRangeStart(v);
                      if (v && rangeEnd && v > rangeEnd) setRangeEnd(v);
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5 sm:flex-initial">
                  <span className="shrink-0 font-medium">To</span>
                  <input
                    className="et-input min-h-10 min-w-0 flex-1 !px-3 !py-2 text-sm sm:min-w-[9.5rem]"
                    type="date"
                    aria-label="Report date range end"
                    value={rangeEnd}
                    min={rangeStart || undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRangeEnd(v);
                      if (v && rangeStart && v < rangeStart) setRangeStart(v);
                    }}
                  />
                </label>
              </div>
            </div>
            {periodLabel ? (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs" title={periodLabel}>
                Period: <span className="font-medium text-slate-600 dark:text-slate-300">{periodLabel}</span>
              </p>
            ) : rangeStart || rangeEnd ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-200/90 sm:text-xs">
                Choose a valid range (From on or before To, both dates set).
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              className="et-btn-secondary !min-h-10 whitespace-nowrap px-3 py-2 text-xs font-semibold sm:text-sm"
              disabled={!exportActionsEnabled}
              onClick={() => setNarrativeOpen(true)}
            >
              Narrative
            </button>
            <ExportPdfButton
              exportFilenameBase={`${rangeStart}_${rangeEnd}`}
              currency={currency}
              disabled={!exportActionsEnabled}
              buttonClassName="rounded-lg !min-h-10 px-3 py-1 text-xs font-semibold sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      ) : null}

      {busy ? (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <PageLoadingShimmer label="Loading report" />
        </div>
      ) : (
        <div className="flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden sm:gap-2">
          <div
            id="report-root"
            className="relative flex max-h-[min(20dvh,132px)] min-h-0 shrink-0 flex-col overflow-hidden sm:max-h-[min(26dvh,200px)] lg:max-h-[min(22dvh,220px)] xl:max-h-[min(26dvh,280px)]"
          >
            <div className="pdf-first-page-header hidden items-start justify-between gap-2 border-b border-slate-300/60 px-1 pt-0.5 pb-1 text-slate-900">
              <div className="inline-flex items-center gap-2">
                <CashLogo size={28} className="shrink-0 translate-y-px" />
                <div className="text-sm font-bold">Expense Tracker</div>
              </div>
              <div className="max-w-[78%] text-right text-xs font-semibold leading-tight sm:text-sm">{displayName}</div>
            </div>
            <div className="report-preview-scroll h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              {report ? <ReportPreview report={report} currency={currency} narrativeText={narrativeText} /> : null}
            </div>

            {report ? (
              <div className="report-pdf-expense-only" aria-hidden="true">
            {pdfExpenseRows.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">Expense breakdown</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  All expense entries for {formatReportDateRangeLabel(rangeStart, rangeEnd, "en-GB")}.
                </p>
                <div className="mt-4 overflow-visible rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="report-table min-w-full text-center text-sm text-slate-800 dark:text-slate-100">
                    <thead className="bg-slate-50 text-slate-700 dark:bg-white/5 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold">No.</th>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Category</th>
                        <th className="px-3 py-2 font-semibold">Amount</th>
                        <th className="px-3 py-2 font-semibold">%</th>
                        <th className="px-3 py-2 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfExpenseRows.map((row, idx) => (
                        <tr key={row.id} className="border-t border-slate-200/80 dark:border-white/10">
                          <td className="px-3 py-2 tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.category}</td>
                          <td className="px-3 py-2 font-medium">{formatMoney(row.amount, currency)}</td>
                          <td className="px-3 py-2 tabular-nums">{row.pctOfTotal.toFixed(2)}%</td>
                          <td className="px-3 py-2">{row.description || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                No expense transactions for this period.
              </div>
            )}
          </div>
            ) : null}
          </div>

          <section
            role="region"
            aria-label="Expense breakdown"
            className="et-card !p-2 sm:!p-3 flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden sm:gap-1.5"
          >
            <div className="shrink-0">
              <input
                className="et-search w-full !min-h-10 !px-3 !py-2 text-sm"
                placeholder="Search expenses"
                title="Search by date, category, amount or description"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="mt-1 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y">
              {!tableRows.length ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-10 text-center dark:border-white/20 dark:bg-white/5">
                  <div className="mb-2 text-3xl" aria-hidden="true">
                    empty
                  </div>
                  <div className="text-base font-semibold text-slate-700 dark:text-slate-200">No expenses recorded yet</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add entries in this date range to see them here.</div>
                </div>
              ) : (
                <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 sm:rounded-xl">
                  <table className="w-max min-w-full table-auto text-center text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-700 dark:bg-white/5 dark:text-slate-200">
                      <tr>
                        <th className="min-w-[5.5rem] whitespace-nowrap px-2 py-1.5 font-semibold sm:px-3 sm:py-2">
                          Date
                        </th>
                        <th className="min-w-[7.5rem] whitespace-nowrap px-2 py-1.5 font-semibold sm:px-3 sm:py-2">
                          Category
                        </th>
                        <th className="min-w-[7.75rem] whitespace-nowrap px-2 py-1.5 font-semibold sm:px-3 sm:py-2">
                          Amount
                        </th>
                        <th
                          className="min-w-[4.25rem] whitespace-nowrap px-2 py-1.5 font-semibold sm:px-3 sm:py-2"
                          title="Share of total expense amount in the current filtered list"
                        >
                          %
                        </th>
                        <th className="min-w-[12rem] whitespace-nowrap px-2 py-1.5 text-center font-semibold sm:px-3 sm:py-2">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200/80 dark:border-white/10">
                          <td className="min-w-[5.5rem] whitespace-nowrap px-2 py-1.5 sm:px-3 sm:py-2">
                            {row.date}
                          </td>
                          <td className="min-w-[7.5rem] whitespace-nowrap px-2 py-1.5 sm:px-3 sm:py-2">
                            {row.category}
                          </td>
                          <td className="min-w-[7.75rem] whitespace-nowrap px-2 py-1.5 font-medium sm:px-3 sm:py-2">
                            {formatMoney(row.amount, currency)}
                          </td>
                          <td className="min-w-[4.25rem] whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700 dark:text-slate-200 sm:px-3 sm:py-2">
                            {row.pctOfTotal.toFixed(2)}%
                          </td>
                          <td className="min-w-[12rem] whitespace-nowrap px-2 py-1.5 text-center sm:px-3 sm:py-2">
                            <span className="mx-auto block max-w-[16rem] truncate text-center">
                              {row.description || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {tableRows.length ? (
              <div className="flex shrink-0 flex-col gap-1.5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:text-sm">
                <div className="text-slate-600 dark:text-slate-300">
                  Page {Math.min(page, totalPages)} of {totalPages}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {page > 1 ? (
                    <button
                      type="button"
                      className="et-btn-secondary min-h-10 flex-1 px-2 py-2 text-xs sm:min-h-12 sm:flex-initial sm:px-3 sm:text-base"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                  ) : null}
                  {page < totalPages ? (
                    <button
                      type="button"
                      className="et-btn-secondary min-h-10 flex-1 px-2 py-2 text-xs sm:min-h-12 sm:flex-initial sm:px-3 sm:text-base"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
      {narrativeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onClick={() => setNarrativeOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="narrative-dialog-title"
            className="et-card max-h-[min(85dvh,640px)] w-full max-w-lg overflow-hidden !p-0 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <div className="min-w-0 pr-2">
                <h2 id="narrative-dialog-title" className="text-base font-bold text-indigo-700 dark:text-indigo-300">
                  Narrative
                </h2>
                {periodLabel ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={periodLabel}>
                    {periodLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="et-btn-secondary !min-h-9 px-3 py-1.5 text-xs font-semibold sm:text-sm"
                onClick={() => setNarrativeOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[min(70dvh,520px)] overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {narrativeText || "—"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

