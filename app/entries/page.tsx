"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";

import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import { useNotifications } from "../../src/components/notifications/NotificationProvider";
import type { Category, Transaction, TransactionType } from "../../src/types/app";
import { createTransaction, deleteTransaction, listTransactionsByMonth } from "../../src/lib/repos/entriesRepo";
import { listCategories } from "../../src/lib/repos/categoriesRepo";
import { PageLoadingShimmer } from "../../src/components/ui/PageLoadingShimmer";
import { IncomeExpenseTabs, type IncomeExpenseTab } from "../../src/components/ui/IncomeExpenseTabs";
import { CURRENCIES } from "../../src/lib/constants/countries";
import { getUserDocument, saveProfile, saveUserDocument } from "../../src/lib/repos/profileRepo";
import { formatUkDate } from "../../src/lib/formatDisplayDate";

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

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value || 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

function formatAmountInput(rawValue: string) {
  const normalized = rawValue.replace(/,/g, "");
  if (normalized === "") return "";
  if (!/^\d*([.]\d{0,2})?$/.test(normalized)) return null;

  const [wholePart, decimalPart] = normalized.split(".");
  let whole = (wholePart ?? "").replace(/^0+/, "");
  if (whole === "" && decimalPart !== undefined) {
    whole = "0";
  }
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (normalized.endsWith(".")) return `${withCommas}.`;
  if (typeof decimalPart === "string") return `${withCommas}.${decimalPart}`;
  return withCommas;
}

export default function EntriesPage() {
  return (
    <RequireAuth>
      <Entries />
    </RequireAuth>
  );
}

function Entries() {
  const { user, profile, userDoc, refreshProfile } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const uid = user?.uid;
  const currency = profile?.currency || userDoc?.preferredCurrency || "USD";

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
  const [description, setDescription] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [listTab, setListTab] = useState<IncomeExpenseTab>("expense");

  const entriesPanelId = "entries-ledger-panel";

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
      const dt = formatUkDate(t.date);
      const joined = [catName, t.type, t.description || "", dt, String(t.amount || "")]
        .join(" ")
        .toLowerCase();
      return joined.includes(q);
    });
  }, [searchText, transactions, categories]);

  const entrySuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const source = transactions.flatMap((t) => {
      const catName = categories.find((c) => c.id === t.categoryId)?.name || "";
      return [catName, t.description || ""];
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

  const sortedIncomeTxs = useMemo(
    () =>
      incomeTransactions
        .slice()
        .sort((a, b) => (b.date?.toMillis ? b.date.toMillis() : 0) - (a.date?.toMillis ? a.date.toMillis() : 0)),
    [incomeTransactions]
  );
  const sortedExpenseTxs = useMemo(
    () =>
      expenseTransactions
        .slice()
        .sort((a, b) => (b.date?.toMillis ? b.date.toMillis() : 0) - (a.date?.toMillis ? a.date.toMillis() : 0)),
    [expenseTransactions]
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
    let cancelled = false;
    setPageLoading(true);
    Promise.all([listCategories(uid), listTransactionsByMonth(uid, monthKey)])
      .then(([cats, txs]) => {
        if (cancelled) return;
        setCategories(cats);
        setTransactions(txs);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  async function onAdd(e: React.FormEvent, onSuccess?: () => void) {
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
        amount: Math.abs(Number(amount.replace(/,/g, "")) || 0),
        type: txType,
        categoryId: cat.id,
        description: description.trim() || undefined,
        monthKey: monthKeyFromDateInput(dateStr)
      });

      // refresh current month if it matches
      const mk = monthKeyFromDateInput(dateStr);
      if (mk === monthKey) await refreshTransactions(monthKey);

      setAmount("0");
      setDescription("");
      notifySuccess("Transaction successfully added.");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      const message = e?.message || String(e);
      setError(message);
      notifyError(`Could not add transaction: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onCurrencyChange(next: string) {
    if (!uid || !user) return;
    setCurrencyBusy(true);
    try {
      const existing = await getUserDocument(uid);
      await saveUserDocument(uid, {
        email: user.email || existing?.email || "",
        displayName: existing?.displayName || user.displayName || "",
        photoURL: existing?.photoURL ?? user.photoURL ?? null,
        preferredCurrency: next
      });
      if (profile) {
        await saveProfile(uid, { ...profile, currency: next });
      }
      await refreshProfile();
      notifySuccess("Currency updated.");
    } catch (e: any) {
      notifyError(e?.message || String(e));
    } finally {
      setCurrencyBusy(false);
    }
  }

  return (
    <div className="flex h-0 min-h-0 w-full min-w-0 flex-1 flex-col gap-1 overflow-hidden sm:gap-2">
      <div className="shrink-0">
        <h1 className="text-lg font-bold text-indigo-700 dark:text-indigo-300 sm:text-2xl">Entries</h1>
        <p className="hidden mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300 sm:block sm:mt-1 sm:text-sm">
          Add every income and expense, and keep it categorized.
        </p>
      </div>

      {pageLoading ? (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <PageLoadingShimmer label="Loading entries" />
        </div>
      ) : (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="et-card !p-2 sm:!p-3 flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-col gap-0.5">
              <div>
                <div className="flex flex-wrap items-center gap-0.5">
                  <h2 className="text-base font-semibold">Transactions</h2>
                  <button
                    type="button"
                    className="et-btn-secondary inline-flex items-center gap-2 !min-h-10 !px-3 !py-2 text-sm"
                    onClick={() => setShowAddTransactionModal(true)}
                  >
                    <span className="text-lg font-bold">+</span>
                    Add
                  </button>
                </div>
                <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{filteredTransactions.length} items</div>
              </div>

              <div className="flex w-full flex-row flex-wrap items-center gap-2">
                <label className="flex min-w-[12rem] flex-1 flex-row flex-wrap items-center justify-start gap-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                  <span className="shrink-0 font-medium">Month</span>
                  <input
                    className="et-input min-w-0 flex-1 !min-h-[2.5rem] !px-3 !py-2 text-sm sm:w-auto sm:flex-initial sm:min-w-[10rem]"
                    type="month"
                    value={monthKey}
                    onChange={(e) => setMonthKey(e.target.value)}
                  />
                </label>
                <label className="ml-auto flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                  <span className="shrink-0 font-medium">Currency</span>
                  <select
                    className="et-input min-w-[10rem] !min-h-[2.5rem] !px-3 !py-2 text-sm sm:min-w-[12rem]"
                    value={currency}
                    disabled={currencyBusy}
                    onChange={(e) => onCurrencyChange(e.target.value)}
                    aria-label="Display currency for amounts"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-1 flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-stretch">
              <input
                className="et-search flex-1 !min-h-[2.5rem] !px-3 !py-2 text-sm"
                placeholder="Search transactions"
                title="Search by category, description, date or amount"
                list="entry-search-suggestions"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button
                type="button"
                className="et-btn-secondary min-w-[5.5rem] shrink-0 sm:w-auto !min-h-10 !px-3 !py-2 text-sm"
                onClick={() => setSearchText("")}
              >
                Clear
              </button>
            </div>

            <datalist id="entry-search-suggestions">
              {entrySuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <div className="mt-1 flex h-0 min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
              <IncomeExpenseTabs
                panelId={entriesPanelId}
                value={listTab}
                onChange={setListTab}
                incomeCount={incomeTransactions.length}
                expenseCount={expenseTransactions.length}
                className="shrink-0"
              />
              <div
                role="tabpanel"
                id={entriesPanelId}
                aria-labelledby={`${entriesPanelId}-tab-${listTab}`}
                className={
                  listTab === "income"
                    ? "h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-emerald-200 bg-emerald-50/40 p-1.5 sm:p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5 [-webkit-overflow-scrolling:touch]"
                    : "h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-rose-200 bg-rose-50/40 p-1.5 sm:p-3 dark:border-rose-500/30 dark:bg-rose-500/5 [-webkit-overflow-scrolling:touch]"
                }
              >
                <h3 className="sr-only">{listTab === "income" ? "Income entries" : "Expense entries"}</h3>
                <div className="grid gap-2">
                  {(listTab === "income" ? sortedIncomeTxs : sortedExpenseTxs).map((t) => {
                    const catName = categories.find((c) => c.id === t.categoryId)?.name || "Unknown";
                    const sign = t.type === "income" ? "+" : "-";
                    const amountStr = `${sign} ${formatMoney(Number(t.amount || 0), currency)}`;
                    return (
                      <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold">{catName}</div>
                            <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{formatUkDate(t.date)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{amountStr}</div>
                            {t.description ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.description}</div> : null}
                            <div className="mt-2">
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
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
                  })}
                  {listTab === "income" && !sortedIncomeTxs.length ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">No income entries found for {monthKey}.</div>
                  ) : null}
                  {listTab === "expense" && !sortedExpenseTxs.length ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">No expense entries found for {monthKey}.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddTransactionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add transaction</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Enter a new income or expense item. The modal will close after you save.</p>
              </div>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={(e) => onAdd(e, () => setShowAddTransactionModal(false))}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      const formatted = formatAmountInput(next);
                      if (formatted !== null) setAmount(formatted);
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
                    required
                  >
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
                <label className="grid gap-2 sm:col-span-2 lg:col-span-3">
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

              <div className="flex flex-wrap items-center gap-3">
                <button className="et-btn-primary" type="submit" disabled={busy || !selectedCategory}>
                  {busy ? "Saving..." : "Add entry"}
                </button>
                <button type="button" className="et-btn-secondary" onClick={() => setShowAddTransactionModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

