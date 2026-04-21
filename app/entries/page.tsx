"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Timestamp } from "firebase/firestore";

import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import { useNotifications } from "../../src/components/notifications/NotificationProvider";
import type { Category, Transaction, TransactionType } from "../../src/types/app";
import {
  createTransaction,
  deleteTransaction,
  listTransactionsByMonth,
  updateTransaction
} from "../../src/lib/repos/entriesRepo";
import { createCategory, listCategories } from "../../src/lib/repos/categoriesRepo";
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

function timestampToDateInputUtc(ts: unknown): string {
  if (ts == null) return "";
  const d =
    typeof ts === "object" && ts !== null && "toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as number);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  /** When set, the open modal updates this transaction instead of creating one. */
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [listTab, setListTab] = useState<IncomeExpenseTab>("expense");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryAddBusy, setCategoryAddBusy] = useState(false);
  const categoryComboboxRef = useRef<HTMLDivElement | null>(null);

  const entriesPanelId = "entries-ledger-panel";

  const typedCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false && c.type === entryType),
    [categories, entryType]
  );

  const selectedCategory = useMemo(
    () => typedCategories.find((c) => c.id === categoryId),
    [typedCategories, categoryId]
  );

  const categoryPickerFiltered = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return typedCategories;
    return typedCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [typedCategories, categoryQuery]);

  const categoryPickerExact = useMemo(() => {
    const t = categoryQuery.trim().toLowerCase();
    if (!t) return null;
    return typedCategories.find((c) => c.name.trim().toLowerCase() === t) ?? null;
  }, [typedCategories, categoryQuery]);

  const showCategoryAddInDropdown = useMemo(() => {
    const t = categoryQuery.trim();
    if (!t) return false;
    if (categoryPickerExact) return false;
    return categoryPickerFiltered.length === 0;
  }, [categoryQuery, categoryPickerExact, categoryPickerFiltered.length]);

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

  async function onQuickAddCategory(nameOverride?: string) {
    if (!uid) return;
    const trimmed = (nameOverride ?? categoryQuery).trim();
    if (!trimmed) return;
    setCategoryAddBusy(true);
    setError(null);
    try {
      const id = await createCategory(uid, { name: trimmed, type: entryType });
      await refreshCategories();
      setCategoryId(id);
      setCategoryQuery(trimmed);
      setCategoryMenuOpen(false);
      notifySuccess("Category added.");
    } catch (e: any) {
      const message = e?.message || String(e);
      setError(message);
      notifyError(`Could not add category: ${message}`);
    } finally {
      setCategoryAddBusy(false);
    }
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
    if (!categoryMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = categoryComboboxRef.current;
      if (el && !el.contains(e.target as Node)) setCategoryMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [categoryMenuOpen]);

  function openAddTransactionModal() {
    setEditingTransactionId(null);
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    setDateStr(`${y}-${m}-${d}`);
    setAmount("0");
    setDescription("");
    const first = categories.filter((c) => c.isActive !== false && c.type === entryType)[0];
    setCategoryId(first?.id ?? "");
    setCategoryQuery(first?.name ?? "");
    setCategoryMenuOpen(false);
    setShowAddTransactionModal(true);
  }

  function openEditTransactionModal(t: Transaction) {
    setEditingTransactionId(t.id);
    setEntryType(t.type);
    setDateStr(timestampToDateInputUtc(t.date));
    const raw = String(Number(t.amount ?? 0));
    const formatted = formatAmountInput(raw);
    setAmount(formatted != null ? formatted : raw);
    setCategoryId(t.categoryId);
    const cat = categories.find((c) => c.id === t.categoryId);
    setCategoryQuery(cat?.name ?? "");
    setDescription(t.description || "");
    setCategoryMenuOpen(false);
    setShowAddTransactionModal(true);
  }

  async function onSaveTransaction(e: React.FormEvent, onSuccess?: () => void) {
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
      const mk = monthKeyFromDateInput(dateStr);
      const amt = Math.abs(Number(amount.replace(/,/g, "")) || 0);
      const descTrim = description.trim();

      if (editingTransactionId) {
        await updateTransaction(uid, editingTransactionId, {
          date: txDate,
          amount: amt,
          type: txType,
          categoryId: cat.id,
          description: descTrim,
          monthKey: mk
        });
        notifySuccess("Transaction updated.");
      } else {
        await createTransaction(uid, {
          date: txDate,
          amount: amt,
          type: txType,
          categoryId: cat.id,
          description: descTrim || undefined,
          monthKey: mk
        });
        notifySuccess("Transaction successfully added.");
      }

      setEditingTransactionId(null);
      setAmount("0");
      setDescription("");
      await refreshTransactions(monthKey);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      const message = e?.message || String(e);
      setError(message);
      notifyError(editingTransactionId ? `Could not update transaction: ${message}` : `Could not add transaction: ${message}`);
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
      {pageLoading ? (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <PageLoadingShimmer label="Loading entries" />
        </div>
      ) : (
        <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="et-card !p-1.5 sm:!p-2 flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-col gap-1">
              <div className="flex w-full items-center justify-between gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="et-btn-secondary inline-flex w-[4.25rem] shrink-0 items-center justify-center gap-1 !min-h-9 !px-2 !py-1.5 text-xs sm:w-auto sm:gap-2 sm:!min-h-9 sm:!px-2.5 sm:!py-1.5 sm:text-sm"
                    data-tour="entries-add"
                    onClick={openAddTransactionModal}
                  >
                    <span className="text-base font-bold sm:text-lg">+</span>
                    Add
                  </button>
                  <label
                    className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-600 dark:text-slate-300 sm:flex-initial sm:gap-2 sm:text-sm"
                    data-tour="entries-month"
                  >
                    <span className="hidden shrink-0 font-medium sm:inline">Month</span>
                    <input
                      className="et-input w-full min-w-0 !min-h-9 !px-2 !py-1.5 text-xs sm:w-[9.25rem] sm:!min-h-9 sm:!px-2.5 sm:!py-1.5 sm:text-sm"
                      type="month"
                      value={monthKey}
                      onChange={(e) => setMonthKey(e.target.value)}
                      aria-label="Month"
                    />
                  </label>
                  <label
                    className="flex shrink-0 items-center gap-1 text-xs text-slate-600 dark:text-slate-300 sm:gap-2 sm:text-sm"
                    data-tour="entries-currency"
                  >
                    <span className="hidden shrink-0 font-medium sm:inline">Currency</span>
                    <select
                      className="et-input w-[5.75rem] shrink-0 !min-h-9 !px-2 !py-1.5 text-xs sm:w-[8.5rem] sm:!min-h-9 sm:!px-2.5 sm:!py-1.5 sm:text-sm"
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
                  <span className="ml-auto hidden shrink-0 pl-1 text-xs text-slate-600 dark:text-slate-300 sm:inline sm:text-sm">
                    {filteredTransactions.length} items
                  </span>
              </div>

              <div className="flex flex-wrap items-stretch gap-2" data-tour="entries-search-row">
                <input
                  className="et-search min-w-0 flex-1 !min-h-9 !px-2.5 !py-1.5 text-sm"
                  placeholder="Search transactions"
                  title="Search by category, description, date or amount"
                  list="entry-search-suggestions"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <button
                  type="button"
                  className="et-btn-secondary w-[4.5rem] shrink-0 !min-h-9 !px-2 !py-1.5 text-sm"
                  onClick={() => setSearchText("")}
                >
                  Clear
                </button>
              </div>
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
                tourAnchor="entries-tabs"
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
                            <div className="mt-2 flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                onClick={() => openEditTransactionModal(t)}
                              >
                                Edit
                              </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <div className="max-h-[min(92dvh,720px)] w-full max-w-4xl overflow-visible rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingTransactionId ? "Edit transaction" : "Add transaction"}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {editingTransactionId
                    ? "Change any field and save. The modal closes after save."
                    : "Enter a new income or expense item. The modal will close after you save."}
                </p>
              </div>
            </div>

            <form className="mt-3 grid gap-2" onSubmit={(e) => onSaveTransaction(e, () => setShowAddTransactionModal(false))}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Category type <span className="text-red-500">*</span></span>
                  <select
                    className="et-input"
                    value={entryType}
                    onChange={(e) => {
                      const nt = e.target.value as TransactionType;
                      setEntryType(nt);
                      const first = categories.filter((c) => c.isActive !== false && c.type === nt)[0];
                      setCategoryId(first?.id ?? "");
                      setCategoryQuery(first?.name ?? "");
                      setCategoryMenuOpen(false);
                    }}
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
                  <div ref={categoryComboboxRef} className="relative">
                    <input
                      className="et-input w-full"
                      role="combobox"
                      aria-expanded={categoryMenuOpen}
                      aria-controls="entry-category-listbox"
                      aria-autocomplete="list"
                      value={categoryQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCategoryQuery(v);
                        setCategoryMenuOpen(true);
                        const exact = typedCategories.find((c) => c.name.trim().toLowerCase() === v.trim().toLowerCase());
                        if (exact) setCategoryId(exact.id);
                        else {
                          const cur = typedCategories.find((c) => c.id === categoryId);
                          if (!cur || cur.name !== v) setCategoryId("");
                        }
                      }}
                      onFocus={(e) => {
                        setCategoryMenuOpen(true);
                        if (e.currentTarget.value) e.currentTarget.select();
                      }}
                      onClick={(e) => {
                        if (e.currentTarget.value) e.currentTarget.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (showCategoryAddInDropdown) {
                            void onQuickAddCategory();
                            return;
                          }
                          if (categoryPickerFiltered.length === 1) {
                            const c = categoryPickerFiltered[0];
                            setCategoryId(c.id);
                            setCategoryQuery(c.name);
                            setCategoryMenuOpen(false);
                          }
                        }
                        if (e.key === "Escape") {
                          setCategoryMenuOpen(false);
                        }
                      }}
                      placeholder={
                        typedCategories.length
                          ? `Search or pick ${entryType} category…`
                          : `Type a name to add your first ${entryType} category…`
                      }
                      autoComplete="off"
                    />
                    {categoryMenuOpen ? (
                      <ul
                        id="entry-category-listbox"
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg dark:border-white/10 dark:bg-slate-900"
                      >
                        {categoryPickerFiltered.map((c) => (
                          <li key={c.id} role="option" aria-selected={c.id === categoryId}>
                            <button
                              type="button"
                              className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-indigo-50 dark:hover:bg-white/10"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setCategoryId(c.id);
                                setCategoryQuery(c.name);
                                setCategoryMenuOpen(false);
                              }}
                            >
                              {c.name}
                            </button>
                          </li>
                        ))}
                        {showCategoryAddInDropdown ? (
                          <li role="option">
                            <button
                              type="button"
                              className="w-full px-2.5 py-1.5 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-white/10"
                              disabled={categoryAddBusy}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => void onQuickAddCategory()}
                            >
                              {categoryAddBusy ? "Adding…" : `Add "${categoryQuery.trim()}"`}
                            </button>
                          </li>
                        ) : null}
                        {!categoryPickerFiltered.length && !showCategoryAddInDropdown ? (
                          <li className="px-2.5 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                            {typedCategories.length
                              ? "No matches. Type a new name, then Add or press Enter."
                              : "Type a category name, then Add or press Enter."}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
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

              <div className="flex flex-wrap items-center gap-2">
                <button className="et-btn-primary" type="submit" disabled={busy || !selectedCategory}>
                  {busy ? "Saving..." : editingTransactionId ? "Save changes" : "Add entry"}
                </button>
                <button
                  type="button"
                  className="et-btn-secondary"
                  onClick={() => {
                    setShowAddTransactionModal(false);
                    setEditingTransactionId(null);
                    setCategoryQuery("");
                    setCategoryMenuOpen(false);
                  }}
                >
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

