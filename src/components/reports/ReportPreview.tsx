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
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:p-5">
      <h2 className="text-lg font-bold text-indigo-700 dark:text-indigo-300 sm:text-xl">
        <span className="report-month-label-screen">{`Report for ${monthKey}`}</span>
        <span className="report-month-label-pdf">{`Report for ${formatReportMonthLabel(monthKey)}`}</span>
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/5 sm:p-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">Total income</div>
          <div className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">{formatMoney(incomeTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/5 sm:p-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">Total expenses</div>
          <div className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">{formatMoney(expensesTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/5 sm:p-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">Net</div>
          <div className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">{formatMoney(net)}</div>
        </div>
      </div>

      <div className="mt-3 sm:mt-5">
        <h3 className="text-base font-semibold sm:text-lg">Narrative</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200 sm:mt-2 sm:text-sm">
          {narrativeText || "—"}
        </p>
      </div>
    </div>
  );
}

