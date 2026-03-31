"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";

import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import type { Category, Transaction, TransactionType } from "../../src/types/app";
import { createTransaction, deleteTransaction, listTransactionsByMonth } from "../../src/lib/repos/entriesRepo";
import { listCategories } from "../../src/lib/repos/categoriesRepo";

function monthKeyFromDateInput(dateStr: string) {
  const [y, m] = String(dateStr || "").split("-");
  if (!y || !m) return "";
  return `${y}-${m}`;
}

function parseDateToUtcTimestamp(dateStr: string) {
  const [y, m, d] = String(dateStr || "").split("-");
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
  return Timestamp.fromDate(dt);
}

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

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value || 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

export default function EntriesPage() {
  return (
    <RequireAuth>
      <Entries />
    </RequireAuth>
  );
}

function Entries() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const currency = profile?.currency || "USD";

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [monthKey, setMonthKey] = useState<string>(() => currentMonthKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateStr, setDateStr] = useState(() => {
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [amount, setAmount] = useState<string>("0");
  const [entryType, setEntryType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [merchantOrPayee, setMerchantOrPayee] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [showAddTransaction, setShowAddTransaction] = useState(true);

  const typedCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false && c.type === entryType),
    [categories, entryType]
  );

  const selectedCategory = useMemo(
    () => typedCategories.find((c) => c.id === categoryId),
    [typedCategories, categoryId]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const catName = categories.find((c) => c.id === t.categoryId)?.name || "";
      const dt = formatDate(t.date);
      const joined = [
        catName,
        t.type,
        t.merchantOrPayee || "",
        t.description || "",
        dt,
        String(t.amount || "")
      ]
        .join(" ")
        .toLowerCase();
      return joined.includes(q);
    });
  }, [searchText, transactions, categories]);

  const entrySuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const source = transactions.flatMap((t) => {
      const catName = categories.find((c) => c.id === t.categoryId)?.name || "";
      return [catName, t.merchantOrPayee || "", t.description || ""];
    });
    const unique = Array.from(new Set(source.filter(Boolean)));
    if (!q) return unique.slice(0, 10);
    return unique.filter((item) => item.toLowerCase().includes(q)).slice(0, 10);
  }, [transactions, categories, searchText]);

  const incomeTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === "income"),
    [filteredTransactions]
  );
  const expenseTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === "expense"),
    [filteredTransactions]
  );

  async function refreshCategories() {
    if (!uid) return;
    const data = await listCategories(uid);
    setCategories(data);
  }

  async function refreshTransactions(mk: string) {
    if (!uid) return;
    const data = await listTransactionsByMonth(uid, mk);
    setTransactions(data);
  }

  useEffect(() => {
    if (!uid) return;
    refreshCategories().catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    refreshTransactions(monthKey).catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, monthKey]);

  useEffect(() => {
    if (!typedCategories.length) {
      setCategoryId("");
      return;
    }
    if (!typedCategories.some((c) => c.id === categoryId)) {
      setCategoryId(typedCategories[0].id);
    }
  }, [typedCategories, categoryId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    if (!dateStr || !categoryId) return;
    const cat = typedCategories.find((c) => c.id === categoryId);
    if (!cat) return;

    setBusy(true);
    setError(null);
    try {
      const txDate = parseDateToUtcTimestamp(dateStr);
      const txType: TransactionType = entryType;

      await createTransaction(uid, {
        date: txDate,
        amount: Math.abs(Number(amount) || 0),
        type: txType,
        categoryId: cat.id,
        merchantOrPayee: merchantOrPayee.trim() || undefined,
        description: description.trim() || undefined,
        monthKey: monthKeyFromDateInput(dateStr)
      });

      // refresh current month if it matches
      const mk = monthKeyFromDateInput(dateStr);
      if (mk === monthKey) await refreshTransactions(monthKey);

      setAmount("0");
      setMerchantOrPayee("");
      setDescription("");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">Entries</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add every income and expense, and keep it categorized.</p>
        </div>
      </div>

      <div className="et-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Add transaction</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {showAddTransaction ? "Enter a new expense or income item." : "Tap the plus icon to add a transaction."}
            </p>
          </div>
          <button
            type="button"
            className="et-btn-secondary inline-flex items-center gap-2"
            onClick={() => setShowAddTransaction((show) => !show)}
          >
            <span className="text-xl font-bold">+</span>
            {showAddTransaction ? "Hide" : "Add"}
          </button>
        </div>

        {showAddTransaction ? (
          <form className="mt-4 grid gap-4" onSubmit={onAdd}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Category type <span className="text-red-500">*</span></span>
                <select
                  className="et-input"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as TransactionType)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Date <span className="text-red-500">*</span></span>
                <input className="et-input" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Amount ({currency}) <span className="text-red-500">*</span></span>
                <input
                  className="et-input"
                  type="text"
                  inputMode="decimal"
                  data-arrow-edit="true"
                  value={amount}
                  onFocus={(e) => {
                    if (e.currentTarget.value === "0") e.currentTarget.select();
                  }}
                  required
                  onKeyDown={(e) => {
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                      e.stopPropagation();
                    }
                  }}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d*([.]\d{0,2})?$/.test(next)) setAmount(next);
                  }}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Category item <span className="text-red-500">*</span></span>
                <select
                  className="et-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!typedCategories.length}
                  required>
                  {!typedCategories.length ? (
                    <option value="">No {entryType} categories yet</option>
                  ) : (
                    <option value="">Select {entryType} category</option>
                  )}
                  {typedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Merchant / Payee</span>
                <input
                  className="et-input"
                  data-arrow-edit="true"
                  value={merchantOrPayee}
                  onFocus={(e) => {
                    if (e.currentTarget.value) e.currentTarget.select();
                  }}
                  onKeyDown={(e) => {
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                      e.stopPropagation();
                    }
                  }}
                  onChange={(e) => setMerchantOrPayee(e.target.value)}
                  placeholder="e.g., Amazon"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">Description</span>
                <input
                  className="et-input"
                  data-arrow-edit="true"
                  value={description}
                  onFocus={(e) => {
                    if (e.currentTarget.value) e.currentTarget.select();
                  }}
                  onKeyDown={(e) => {
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                      e.stopPropagation();
                    }
                  }}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional note"
                />
              </label>
            </div>

            {error ? <div className="text-sm text-red-200">{error}</div> : null}

            <button className="et-btn-primary" type="submit" disabled={busy || !selectedCategory}>
              {busy ? "Saving..." : "Add entry"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="et-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{filteredTransactions.length} items</div>
          </div>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Month
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/5 sm:w-auto"
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/5"
            placeholder="Search category, merchant, description, date or amount"
            list="entry-search-suggestions"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button
            type="button"
            className="h-11 min-w-24 rounded-xl border border-slate-200 bg-white px-4 font-semibold hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => {
              setSearchText("");
            }}
          >
            Clear
          </button>
        </div>
        <datalist id="entry-search-suggestions">
          {entrySuggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
            <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-300">Income</h3>
            <div className="mt-2 grid gap-3">
              {incomeTransactions.length ? (
                incomeTransactions
                  .slice()
                  .sort((a, b) => (b.date?.toMillis ? b.date.toMillis() : 0) - (a.date?.toMillis ? a.date.toMillis() : 0))
                  .map((t) => {
                    const catName = categories.find((c) => c.id === t.categoryId)?.name || "Unknown";
                    const sign = t.type === "income" ? "+" : "-";
                    const amountStr = `${sign} ${formatMoney(Number(t.amount || 0), currency)}`;
                    return (
                      <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">{catName}</div>
                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{formatDate(t.date)}</div>
                            {t.merchantOrPayee ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.merchantOrPayee}</div> : null}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold">{amountStr}</div>
                            {t.description ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.description}</div> : null}
                            <div className="mt-3">
                              <button
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                onClick={async () => {
                                  if (!uid) return;
                                  const ok = confirm("Delete this entry?");
                                  if (!ok) return;
                                  await deleteTransaction(uid, t.id);
                                  await refreshTransactions(monthKey);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">No income entries found for {monthKey}.</div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-500/30 dark:bg-rose-500/5">
            <h3 className="text-base font-semibold text-rose-700 dark:text-rose-300">Expense</h3>
            <div className="mt-2 grid gap-3">
              {expenseTransactions.length ? (
                expenseTransactions
                  .slice()
                  .sort((a, b) => (b.date?.toMillis ? b.date.toMillis() : 0) - (a.date?.toMillis ? a.date.toMillis() : 0))
                  .map((t) => {
                    const catName = categories.find((c) => c.id === t.categoryId)?.name || "Unknown";
                    const sign = t.type === "income" ? "+" : "-";
                    const amountStr = `${sign} ${formatMoney(Number(t.amount || 0), currency)}`;
                    return (
                      <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">{catName}</div>
                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{formatDate(t.date)}</div>
                            {t.merchantOrPayee ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.merchantOrPayee}</div> : null}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold">{amountStr}</div>
                            {t.description ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.description}</div> : null}
                            <div className="mt-3">
                              <button
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                onClick={async () => {
                                  if (!uid) return;
                                  const ok = confirm("Delete this entry?");
                                  if (!ok) return;
                                  await deleteTransaction(uid, t.id);
                                  await refreshTransactions(monthKey);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">No expense entries found for {monthKey}.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

