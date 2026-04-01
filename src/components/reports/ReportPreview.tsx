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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
        <span className="report-month-label-screen">{`Report for ${monthKey}`}</span>
        <span className="report-month-label-pdf">{`Report for ${formatReportMonthLabel(monthKey)}`}</span>
      </h2>
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
        <h3 className="text-lg font-semibold">Narrative</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
          {narrativeText || "—"}
        </p>
      </div>
    </div>
  );
}

