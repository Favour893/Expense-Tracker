"use client";

import React from "react";
import { type MonthlyReport } from "../../lib/reporting/reportModel";

export function ReportPreview({
  report,
  currency,
  narrativeText
}: {
  report: MonthlyReport;
  currency: string;
  narrativeText: string;
}) {
  const incomeTotal = report?.totals?.incomeTotal ?? 0;
  const expensesTotal = report?.totals?.expensesTotal ?? 0;
  const net = report?.totals?.net ?? 0;

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:rounded-2xl sm:p-3">
      <div className="mt-1.5 grid grid-cols-3 gap-1 sm:mt-2 sm:gap-1.5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-2">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Income</div>
          <div className="mt-0.5 break-words text-[0.68rem] font-bold leading-tight sm:mt-0.5 sm:text-lg">{formatMoney(incomeTotal)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-2">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Expenses</div>
          <div className="mt-0.5 break-words text-[0.68rem] font-bold leading-tight sm:mt-0.5 sm:text-lg">{formatMoney(expensesTotal)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-2">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Net</div>
          <div className="mt-0.5 break-words text-[0.68rem] font-bold leading-tight sm:mt-0.5 sm:text-lg">{formatMoney(net)}</div>
        </div>
      </div>

      {/* Kept in #report-root for PDF capture; hidden on screen via globals.css (.report-narrative-pdf-slot). */}
      <div className="report-narrative-pdf-slot mt-1.5 sm:mt-3">
        <h3 className="text-xs font-semibold sm:text-lg">Narrative</h3>
        <p className="report-narrative-text mt-0.5 whitespace-pre-wrap text-[0.68rem] leading-snug text-slate-700 dark:text-slate-200 sm:mt-1 sm:text-sm">
          {narrativeText || "—"}
        </p>
      </div>
    </div>
  );
}

