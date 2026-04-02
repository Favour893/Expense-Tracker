"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import type { Category, Transaction } from "../../src/types/app";
import { listCategories } from "../../src/lib/repos/categoriesRepo";
import { listTransactionsByMonth } from "../../src/lib/repos/entriesRepo";
import {
  computeMonthlyReport,
  computeTop3ExpensePercentSumRounded1,
  formatReportMonthLabel,
  renderNarrative,
  shiftMonthKey
} from "../../src/lib/reporting/reportModel";
import { ReportPreview } from "../../src/components/reports/ReportPreview";
import { ExportPdfButton } from "../../src/components/reports/ExportPdfButton";
import { PageLoadingShimmer } from "../../src/components/ui/PageLoadingShimmer";
import { formatUkDate } from "../../src/lib/formatDisplayDate";
import { CashLogo } from "../../src/components/branding/CashLogo";

function currentMonthKey() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dateInputValue(ts: any) {
  if (!ts) return "";
  const dt = ts.toDate ? ts.toDate() : new Date(ts);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState<Transaction[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [dateInputMode, setDateInputMode] = useState<"text" | "date">("text");
  const [sortBy, setSortBy] = useState<"date" | "category" | "amount" | "description">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const report = useMemo(() => {
    if (!categories) return null;
    return computeMonthlyReport({
      transactions,
      categories,
      monthKey,
      lastMonthTransactions
    });
  }, [categories, lastMonthTransactions, monthKey, transactions]);

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === "expense"),
    [transactions]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );

  const filteredExpenseTransactions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return expenseTransactions.filter((t) => {
      const categoryName = categoryMap.get(t.categoryId) || "Unknown";
      if (selectedCategoryId && t.categoryId !== selectedCategoryId) return false;
      if (selectedDate && dateInputValue(t.date) !== selectedDate) return false;
      if (!q) return true;
      const joined = [formatUkDate(t.date), categoryName, String(t.amount || ""), t.description || ""]
        .join(" ")
        .toLowerCase();
      return joined.includes(q);
    });
  }, [categories, expenseTransactions, searchText, selectedCategoryId, selectedDate]);

  const filteredExpenseTotal = useMemo(
    () => filteredExpenseTransactions.reduce((s, t) => s + Number(t.amount || 0), 0),
    [filteredExpenseTransactions]
  );

  const top3PercentSumRoundedFromTable = useMemo(
    () => computeTop3ExpensePercentSumRounded1(filteredExpenseTransactions, categories),
    [filteredExpenseTransactions, categories]
  );

  const narrativeText = useMemo(() => {
    if (!report) return "";
    const hasLastMonth = lastMonthTransactions.length > 0;
    return renderNarrative({
      report,
      currency,
      monthKey,
      hasLastMonth,
      locale: "en-GB",
      top3PercentSumRounded1Override: top3PercentSumRoundedFromTable,
      top3SpendingBasisTotal: filteredExpenseTotal
    });
  }, [
    currency,
    filteredExpenseTotal,
    lastMonthTransactions.length,
    monthKey,
    report,
    top3PercentSumRoundedFromTable
  ]);

  /** Full month, all expense rows — included in PDF export (#report-root). */
  const pdfExpenseRows = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const sorted = expenseTransactions.slice().sort((a, b) => {
      const dateA = a.date?.toMillis ? a.date.toMillis() : 0;
      const dateB = b.date?.toMillis ? b.date.toMillis() : 0;
      return dateB - dateA;
    });
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

    const sorted = filteredExpenseTransactions.slice().sort((a, b) => {
      const categoryA = (categoryMap.get(a.categoryId) || "Unknown").toLowerCase();
      const categoryB = (categoryMap.get(b.categoryId) || "Unknown").toLowerCase();
      const descriptionA = (a.description || "").toLowerCase();
      const descriptionB = (b.description || "").toLowerCase();
      const dateA = a.date?.toMillis ? a.date.toMillis() : 0;
      const dateB = b.date?.toMillis ? b.date.toMillis() : 0;
      const amountA = Number(a.amount || 0);
      const amountB = Number(b.amount || 0);

      let compare = 0;
      if (sortBy === "date") compare = dateA - dateB;
      if (sortBy === "category") compare = categoryA.localeCompare(categoryB);
      if (sortBy === "amount") compare = amountA - amountB;
      if (sortBy === "description") compare = descriptionA.localeCompare(descriptionB);
      return sortDir === "asc" ? compare : -compare;
    });

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
  }, [categories, filteredExpenseTransactions, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [page, tableRows, totalPages]);

  useEffect(() => {
    if (selectedCategoryId && !expenseCategories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId("");
    }
  }, [expenseCategories, selectedCategoryId]);

  useEffect(() => {
    setPage(1);
  }, [monthKey, searchText, selectedCategoryId, selectedDate, sortBy, sortDir]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    <div className="flex h-0 min-h-0 w-full min-w-0 flex-1 flex-col gap-1 overflow-hidden sm:gap-2">
      <div className="shrink-0 flex flex-col gap-1 sm:gap-2">
        <div className="flex flex-col gap-1 sm:block">
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-lg font-bold text-transparent sm:text-2xl">
            Monthly Reports
          </h1>
          <p className="hidden text-xs text-slate-600 dark:text-slate-300 sm:mt-1 sm:block sm:text-sm">
            Preview in the browser, then export as PDF.
          </p>
        </div>
        <label className="flex w-full flex-row flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 sm:ml-auto sm:w-auto sm:justify-end sm:text-sm">
          <span className="shrink-0 font-medium">Month</span>
          <input
            className="et-input min-h-11 min-w-0 flex-1 py-2.5 text-sm sm:min-h-12 sm:w-auto sm:flex-initial sm:py-3 sm:text-base sm:min-w-[10rem]"
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      ) : null}

      <div className="shrink-0 flex flex-row items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 px-2 py-1.5 dark:border-white/10 dark:from-white/5 dark:to-white/5 sm:rounded-xl sm:p-3 md:gap-3 lg:px-2.5 lg:py-2 lg:sm:p-2.5">
        <div className="min-w-0 truncate text-[11px] text-slate-600 dark:text-slate-300 sm:text-sm">
          {busy ? "Loading…" : "Ready"}
        </div>
        <ExportPdfButton
          monthKey={monthKey}
          currency={currency}
          disabled={busy || !report}
          buttonClassName="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold sm:rounded-xl sm:px-4 sm:py-2 sm:text-base"
        />
      </div>

      {busy ? (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <PageLoadingShimmer label="Loading report" />
        </div>
      ) : (
        <div className="flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-3">
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
              {report ? <ReportPreview report={report} monthKey={monthKey} currency={currency} narrativeText={narrativeText} /> : null}
            </div>

            {report ? (
              <div className="report-pdf-expense-only" aria-hidden="true">
            {pdfExpenseRows.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">Expense breakdown</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  All expense entries for {formatReportMonthLabel(monthKey)}.
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
                          <td className="px-3 py-2 tabular-nums">{row.pctOfTotal.toFixed(1)}%</td>
                          <td className="px-3 py-2">{row.description || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                No expense transactions for this month.
              </div>
            )}
          </div>
            ) : null}
          </div>

          <section
            role="region"
            aria-label="Expense breakdown"
            className="et-card flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y sm:gap-2"
          >
            <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <h2 className="text-sm font-semibold sm:text-lg">Expense breakdown</h2>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 sm:text-sm">{tableRows.length} records</div>
            </div>

            <div className="grid shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 md:grid-cols-2 lg:grid-cols-4">
              <input
                className="et-search col-span-full lg:col-span-1"
                placeholder="Search expenses"
                title="Search by date, category, amount or description"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <select className="et-input" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                <option value="">All expense categories</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className="et-input"
                type={dateInputMode}
                placeholder="Select date"
                value={selectedDate}
                onFocus={() => setDateInputMode("date")}
                onBlur={() => {
                  if (!selectedDate) setDateInputMode("text");
                }}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedDate(next);
                  if (!next) setDateInputMode("text");
                }}
              />
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
                <select
                  className="et-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date" | "category" | "amount" | "description")}
                >
                  <option value="date">Sort: Date</option>
                  <option value="category">Sort: Category</option>
                  <option value="amount">Sort: Amount</option>
                  <option value="description">Sort: Description</option>
                </select>
                <select className="et-input" value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>

            <div className="min-w-0 shrink-0">
              {!tableRows.length ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-10 text-center dark:border-white/20 dark:bg-white/5">
                  <div className="mb-2 text-3xl" aria-hidden="true">
                    empty
                  </div>
                  <div className="text-base font-semibold text-slate-700 dark:text-slate-200">No expenses recorded yet</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add entries for this month to see them here.</div>
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
                            {row.pctOfTotal.toFixed(1)}%
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
    </div>
  );
}

