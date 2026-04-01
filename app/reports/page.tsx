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

function formatDate(ts: any) {
  if (!ts) return "";
  const dt = ts.toDate ? ts.toDate() : new Date(ts);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
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

  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState<Transaction[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "category" | "amount" | "description">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  const tableRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const filtered = transactions.filter((t) => {
      const categoryName = categoryMap.get(t.categoryId) || "Unknown";
      if (selectedCategoryId && t.categoryId !== selectedCategoryId) return false;
      if (selectedDate && dateInputValue(t.date) !== selectedDate) return false;
      if (!q) return true;
      const joined = [formatDate(t.date), categoryName, String(t.amount || ""), t.description || "", t.merchantOrPayee || ""]
        .join(" ")
        .toLowerCase();
      return joined.includes(q);
    });

    const sorted = filtered.slice().sort((a, b) => {
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

    return sorted.map((t) => ({
      id: t.id,
      date: formatDate(t.date),
      category: categoryMap.get(t.categoryId) || "Unknown",
      amount: Number(t.amount || 0),
      description: t.description || ""
    }));
  }, [categories, searchText, selectedCategoryId, selectedDate, sortBy, sortDir, transactions]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [page, tableRows, totalPages]);

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
    <div className="grid gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-2xl font-bold text-transparent">Monthly Reports</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Preview in the browser first, then export the same report as a PDF.</p>
        </div>
        <label className="ml-auto flex w-full flex-row flex-wrap items-center justify-end gap-4 text-sm text-slate-600 dark:text-slate-300 sm:w-auto">
          <span className="shrink-0 font-medium">Select Month</span>
          <input className="et-input min-w-0 flex-1 sm:w-auto sm:flex-initial" type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
        </label>
      </div>

      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-3 sm:flex-row sm:items-center dark:border-white/10 dark:from-white/5 dark:to-white/5">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {busy ? "Loading report..." : "Report ready."}
        </div>
        <ExportPdfButton monthKey={monthKey} currency={currency} />
      </div>

      {report ? <ReportPreview report={report} monthKey={monthKey} currency={currency} narrativeText={narrativeText} /> : null}

      <section className="et-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Expense Breakdown Table</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300">{tableRows.length} records</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            className="et-input"
            placeholder="Search date, category, amount, description"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select className="et-input" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="et-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
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

        {!tableRows.length ? (
          <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 p-6 text-center dark:border-white/20 dark:bg-white/5">
            <div className="mb-2 text-3xl" aria-hidden="true">
              empty
            </div>
            <div className="text-base font-semibold text-slate-700 dark:text-slate-200">No expenses recorded yet</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add entries for this month to see them here.</div>
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-700 dark:bg-white/5 dark:text-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200/80 dark:border-white/10">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.category}</td>
                      <td className="px-3 py-2 font-medium">{formatMoney(row.amount, currency)}</td>
                      <td className="px-3 py-2">{row.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="text-slate-600 dark:text-slate-300">
                Page {Math.min(page, totalPages)} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="et-btn-secondary px-3 py-2"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="et-btn-secondary px-3 py-2"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

