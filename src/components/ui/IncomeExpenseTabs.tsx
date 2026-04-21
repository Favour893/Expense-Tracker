"use client";

import React from "react";

export type IncomeExpenseTab = "income" | "expense";

type Props = {
  value: IncomeExpenseTab;
  onChange: (tab: IncomeExpenseTab) => void;
  /** Shared `id` for the visible tabpanel (both tabs control the same panel). */
  panelId: string;
  incomeCount?: number;
  expenseCount?: number;
  className?: string;
};

export function IncomeExpenseTabs({ value, onChange, panelId, incomeCount, expenseCount, className = "" }: Props) {
  const incomeTabId = `${panelId}-tab-income`;
  const expenseTabId = `${panelId}-tab-expense`;

  return (
    <div
      className={`grid grid-cols-2 gap-0.5 sm:gap-1 ${className}`}
      role="tablist"
      aria-label="Income or expenses"
    >
      <button
        type="button"
        role="tab"
        id={incomeTabId}
        aria-controls={panelId}
        aria-selected={value === "income"}
        className={`min-h-[2rem] sm:min-h-[2.35rem] rounded-xl border-2 px-1.5 py-1 text-center text-[12px] sm:px-2 sm:py-1.5 sm:text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
          value === "income"
            ? "border-emerald-600 bg-emerald-600 text-white shadow-md dark:border-emerald-500"
            : "border-slate-200 bg-white text-emerald-900 hover:border-emerald-400/60 hover:bg-emerald-50/60 dark:border-white/15 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
        }`}
        onClick={() => onChange("income")}
      >
        Income{incomeCount != null ? ` (${incomeCount})` : ""}
      </button>
      <button
        type="button"
        role="tab"
        id={expenseTabId}
        aria-controls={panelId}
        aria-selected={value === "expense"}
        className={`min-h-[2rem] sm:min-h-[2.35rem] rounded-xl border-2 px-1.5 py-1 text-center text-[12px] sm:px-2 sm:py-1.5 sm:text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
          value === "expense"
            ? "border-rose-600 bg-rose-600 text-white shadow-md dark:border-rose-500"
            : "border-slate-200 bg-white text-rose-900 hover:border-rose-400/60 hover:bg-rose-50/60 dark:border-white/15 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-500/15"
        }`}
        onClick={() => onChange("expense")}
      >
        Expenses{expenseCount != null ? ` (${expenseCount})` : ""}
      </button>
    </div>
  );
}
