"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/components/auth/AuthProvider";
import type { Category, CategoryType } from "../../src/types/app";
import { createCategory, deleteCategory, listCategories } from "../../src/lib/repos/categoriesRepo";

export default function CategoriesPage() {
  return (
    <RequireAuth>
      <Categories />
    </RequireAuth>
  );
}

function Categories() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [searchText, setSearchText] = useState("");

  const filteredCategories = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const joined = `${c.name} ${c.type}`.toLowerCase();
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
    refresh().catch((e) => setError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const parsedSortOrder = Number(sortOrder || "0");
      await createCategory(uid, { name: trimmed, type, sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0 });
      setName("");
      setSortOrder("0");
      await refresh();
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
          <h1 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">Categories</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create income/expense categories so every entry has a clear purpose.</p>
        </div>
      </div>

      <div className="et-card">
        <form className="grid gap-4" onSubmit={onAdd}>
          <div className="grid gap-4 sm:grid-cols-3">
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
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Sort order</span>
              <input
                className="et-input"
                type="text"
                inputMode="numeric"
                data-arrow-edit="true"
                value={sortOrder}
                onFocus={(e) => {
                  if (e.currentTarget.value === "0") e.currentTarget.select();
                }}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                    e.stopPropagation();
                  }
                }}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^-?\d+$/.test(next)) setSortOrder(next);
                }}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="et-btn-primary min-w-40"
              disabled={busy || !name.trim()}
            >
              {busy ? "Adding..." : "Add category"}
            </button>
            {error ? <div className="text-sm text-red-200">{error}</div> : null}
          </div>
        </form>
      </div>

      <div className="et-card">
        <h2 className="text-lg font-semibold">Your categories</h2>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/5"
            placeholder="Search category name or type"
            list="category-search-suggestions"
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
        <datalist id="category-search-suggestions">
          {categorySuggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        {!categories.length ? (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">No categories yet. Add one above.</div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
            <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-300">Income</h3>
            <div className="mt-2 grid gap-3">
              {incomeCategories.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">income</div>
                    </div>
                    <button
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      onClick={async () => {
                        if (!uid) return;
                        const ok = confirm(`Delete category "${c.name}"?`);
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
              {!incomeCategories.length ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">No income categories yet.</div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-500/30 dark:bg-rose-500/5">
            <h3 className="text-base font-semibold text-rose-700 dark:text-rose-300">Expense</h3>
            <div className="mt-2 grid gap-3">
              {expenseCategories.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">expense</div>
                    </div>
                    <button
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      onClick={async () => {
                        if (!uid) return;
                        const ok = confirm(`Delete category "${c.name}"?`);
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
              {!expenseCategories.length ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">No expense categories yet.</div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

