"use client";

import React from "react";
import { formatReportMonthLabel, type MonthlyReport } from "../../lib/reporting/reportModel";

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

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:rounded-2xl sm:p-5">
      <h2 className="text-sm font-bold leading-tight text-indigo-700 dark:text-indigo-300 sm:text-xl">
        <span className="report-month-label-screen">{`Report for ${monthKey}`}</span>
        <span className="report-month-label-pdf">{`Report for ${formatReportMonthLabel(monthKey)}`}</span>
      </h2>
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-3">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Income</div>
          <div className="mt-0.5 break-words text-[0.7rem] font-bold leading-tight sm:mt-1 sm:text-2xl">{formatMoney(incomeTotal)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-3">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Expenses</div>
          <div className="mt-0.5 break-words text-[0.7rem] font-bold leading-tight sm:mt-1 sm:text-2xl">{formatMoney(expensesTotal)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-3">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Net</div>
          <div className="mt-0.5 break-words text-[0.7rem] font-bold leading-tight sm:mt-1 sm:text-2xl">{formatMoney(net)}</div>
        </div>
      </div>

      <div className="mt-2 sm:mt-5">
        <h3 className="text-xs font-semibold sm:text-lg">Narrative</h3>
        <p
          className="report-narrative-text mt-1 line-clamp-4 whitespace-pre-wrap text-[0.7rem] leading-snug text-slate-700 dark:text-slate-200 sm:mt-2 md:line-clamp-none md:text-sm"
        >
          {narrativeText || "—"}
        </p>
      </div>
    </div>
  );
}

