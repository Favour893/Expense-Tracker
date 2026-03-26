"use client";

import React from "react";
import type { MonthlyReport } from "../../lib/reporting/reportModel";

export function ReportPreview({
  report,
  monthKey,
  currency,
  narrativeText
}: {
  report: MonthlyReport;
  monthKey: string;
  currency: string;
  narrativeText: string;
}) {
  const incomeTotal = report?.totals?.incomeTotal ?? 0;
  const expensesTotal = report?.totals?.expensesTotal ?? 0;
  const net = report?.totals?.net ?? 0;

  const breakdown = report?.breakdown ?? [];
  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div id="report-root" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{`Report for ${monthKey}`}</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Total income</div>
          <div className="mt-1 text-2xl font-bold">{formatMoney(incomeTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Total expenses</div>
          <div className="mt-1 text-2xl font-bold">{formatMoney(expensesTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Net</div>
          <div className="mt-1 text-2xl font-bold">{formatMoney(net)}</div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-semibold">Expense breakdown</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="report-table w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-sm text-slate-600 dark:text-slate-200">
                <th className="pb-2 pr-2">Category</th>
                <th className="pb-2 pr-2 text-right">Amount</th>
                <th className="pb-2 text-right">% of expenses</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length ? (
                breakdown.map((row) => (
                  <tr key={row.categoryId} className="border-b border-slate-200 dark:border-white/10">
                    <td className="py-2 pr-2">{row.categoryName}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(row.amount)}</td>
                    <td className="py-2 text-right">{(row.pctOfExpenses * 100).toFixed(0)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-sm text-slate-600 dark:text-slate-300">
                    No expense entries for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-semibold">Narrative</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
          {narrativeText || "—"}
        </p>
      </div>
    </div>
  );
}

