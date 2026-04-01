
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import { useNotifications } from "../../src/components/notifications/NotificationProvider";
import type { Category, CategoryType } from "../../src/types/app";
import { createCategory, deleteCategory, listCategories } from "../../src/lib/repos/categoriesRepo";
import { PageLoadingShimmer } from "../../src/components/ui/PageLoadingShimmer";
import { IncomeExpenseTabs, type IncomeExpenseTab } from "../../src/components/ui/IncomeExpenseTabs";

export default function CategoriesPage() {
  return (
    <RequireAuth>
      <Categories />
    </RequireAuth>
  );
}

function Categories() {
  const { user } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const uid = user?.uid;

  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [searchText, setSearchText] = useState("");
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [listTab, setListTab] = useState<IncomeExpenseTab>("expense");

  const categoriesPanelId = "categories-ledger-panel";

  const filteredCategories = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const joined = (c.name + " " + c.type).toLowerCase();
      return joined.includes(q);
    });
  }, [categories, searchText]);

  const categorySuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const source = categories.map((c) => c.name);
    const unique = Array.from(new Set(source));
    if (!q) return unique.slice(0, 8);
    return unique.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [categories, searchText]);

  const incomeCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === "income"),
    [filteredCategories]
  );
  const expenseCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === "expense"),
    [filteredCategories]
  );

  async function refresh() {
    if (!uid) return;
    const data = await listCategories(uid);
    setCategories(data);
  }

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setInitialLoad(true);
    listCategories(uid)
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setInitialLoad(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function onAdd(e: React.FormEvent, onSuccess?: () => void) {
    e.preventDefault();
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      await createCategory(uid, { name: trimmed, type });
      setName("");
      await refresh();
      notifySuccess("Category successfully added.");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      const message = e?.message || String(e);
      setError(message);
      notifyError(`Could not add category: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 sm:text-2xl">Categories</h1>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300 sm:mt-1 sm:text-sm">
          Create income/expense categories so every entry has a clear purpose.
        </p>
      </div>

      {initialLoad ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageLoadingShimmer label="Loading categories" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="et-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Your categories</h2>
              <button
                type="button"
                className="et-btn-secondary inline-flex items-center gap-2"
                onClick={() => setShowAddCategoryModal(true)}
              >
                <span className="text-xl font-bold">+</span>
                Add category
              </button>
            </div>

            <div className="mt-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                className="et-search flex-1"
                placeholder="Search categories"
                title="Search by category name or type"
                list="category-search-suggestions"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button
                type="button"
                className="et-btn-secondary min-w-[5.5rem] shrink-0 sm:w-auto"
                onClick={() => setSearchText("")}
              >
                Clear
              </button>
            </div>

            <datalist id="category-search-suggestions">
              {categorySuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            {!categories.length ? (
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
                No categories yet. Use the add button above to create one.
              </div>
            ) : (
              <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                <IncomeExpenseTabs
                  panelId={categoriesPanelId}
                  value={listTab}
                  onChange={setListTab}
                  incomeCount={incomeCategories.length}
                  expenseCount={expenseCategories.length}
                  className="shrink-0"
                />
                <div
                  role="tabpanel"
                  id={categoriesPanelId}
                  aria-labelledby={`${categoriesPanelId}-tab-${listTab}`}
                  className={
                    listTab === "income"
                      ? "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                      : "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-500/30 dark:bg-rose-500/5"
                  }
                >
                  <h3 className="sr-only">{listTab === "income" ? "Income categories" : "Expense categories"}</h3>
                  <div className="grid gap-2">
                    {(listTab === "income" ? incomeCategories : expenseCategories).map((c) => (
                      <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{c.name}</div>
                          </div>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            onClick={async () => {
                              if (!uid) return;
                              const ok = confirm("Delete category \"" + c.name + "\"?");
                              if (!ok) return;
                              await deleteCategory(uid, c.id);
                              await refresh();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {listTab === "income" && !incomeCategories.length ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">No income categories yet.</div>
                    ) : null}
                    {listTab === "expense" && !expenseCategories.length ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">No expense categories yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddCategoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add category</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create a new category. The modal closes after save.</p>
              </div>
              <button
                type="button"
                className="et-btn-secondary inline-flex items-center gap-2"
                onClick={() => setShowAddCategoryModal(false)}
              >
                Close
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={(e) => onAdd(e, () => setShowAddCategoryModal(false))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Type <span className="text-red-500">*</span></span>
                  <select className="et-input" value={type} onChange={(e) => setType(e.target.value as CategoryType)} required>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Name <span className="text-red-500">*</span></span>
                  <input
                    className="et-input"
                    data-arrow-edit="true"
                    value={name}
                    onFocus={(e) => {
                      if (e.currentTarget.value) e.currentTarget.select();
                    }}
                    onKeyDown={(e) => {
                      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                        e.stopPropagation();
                      }
                    }}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Groceries"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="et-btn-primary" disabled={busy || !name.trim()}>
                  {busy ? "Adding..." : "Add category"}
                </button>
                <button type="button" className="et-btn-secondary" onClick={() => setShowAddCategoryModal(false)}>
                  Cancel
                </button>
                {error ? <div className="text-sm text-red-200">{error}</div> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
