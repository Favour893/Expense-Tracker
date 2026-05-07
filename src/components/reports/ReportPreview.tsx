"use client";

import React from "react";
import { type MonthlyReport } from "../../lib/reporting/reportModel";

/** Legend rows per wrapped column on wide screens (each chunk is one flex item). */
const LEGEND_ROWS_PER_CHUNK = 5;

function chunkLegendSlices<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

const PIE_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#EC4899",
  "#84CC16",
  "#F97316",
  "#06B6D4",
  "#6366F1"
];

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

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
  const startingIncome = report?.totals?.startingIncome ?? 0;
  const expensesTotal = report?.totals?.expensesTotal ?? 0;
  const net = report?.totals?.net ?? 0;
  const pieRows = report?.breakdown?.filter((row) => Number(row.amount || 0) > 0) ?? [];

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const pieSlices = (() => {
    if (!pieRows.length || expensesTotal <= 0) return [];
    let acc = -Math.PI / 2;
    return pieRows.map((row, idx) => {
      const pct = Number(row.amount || 0) / expensesTotal;
      const start = acc;
      const end = acc + pct * Math.PI * 2;
      acc = end;
      return {
        id: `${row.categoryId}-${idx}`,
        categoryName: row.categoryName,
        amount: Number(row.amount || 0),
        pct,
        color: PIE_COLORS[idx % PIE_COLORS.length],
        path: pieSlicePath(50, 50, 40, start, end)
      };
    });
  })();

  const legendChunks = chunkLegendSlices(pieSlices, LEGEND_ROWS_PER_CHUNK);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-md shadow-indigo-100/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:rounded-2xl sm:p-3">
      <div className="mt-1.5 grid grid-cols-3 gap-1 sm:mt-2 sm:gap-1.5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5 sm:rounded-xl sm:p-2">
          <div className="text-[0.65rem] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-xs">Income</div>
          <div className="mt-0.5 break-words text-[0.68rem] font-bold leading-tight sm:mt-0.5 sm:text-lg">{formatMoney(incomeTotal)}</div>
          {Math.abs(startingIncome) > 1e-9 ? (
            <div className="mt-0.5 text-[0.58rem] leading-snug text-slate-500 dark:text-slate-400 sm:text-[0.65rem]">
              Includes {formatMoney(startingIncome)} from previous month&apos;s net
            </div>
          ) : null}
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

      <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5 sm:mt-2 sm:rounded-xl sm:p-2">
        <h3 className="text-[0.7rem] font-semibold text-slate-700 dark:text-slate-200 sm:text-sm">Expense categories</h3>
        {!pieSlices.length ? (
          <p className="mt-1 text-[0.68rem] text-slate-600 dark:text-slate-300 sm:text-xs">No expense data in this period.</p>
        ) : (
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(128px,162px)_minmax(0,1fr)] sm:items-start sm:justify-start">
            <div className="mx-auto w-[8.25rem] sm:w-full">
              <svg viewBox="0 0 100 100" role="img" aria-label="Expense category pie chart" className="h-auto w-full">
                {pieSlices.map((slice) => (
                  <path
                    key={slice.id}
                    d={slice.path}
                    fill={slice.color}
                    stroke="var(--et-chart-slice-stroke)"
                    strokeWidth="1"
                  />
                ))}
                <circle cx="50" cy="50" r="24" fill="var(--et-chart-donut-center)" />
                <text x="50" y="47" textAnchor="middle" className="fill-slate-700 text-[5px] font-semibold dark:fill-slate-100">
                  Total
                </text>
                <text x="50" y="55" textAnchor="middle" className="fill-slate-700 text-[4px] font-medium dark:fill-slate-100">
                  {formatMoney(expensesTotal)}
                </text>
              </svg>
            </div>
            <div className="report-legend-stack flex min-h-0 min-w-0 w-full flex-wrap content-start gap-x-4 gap-y-3 pr-0.5 sm:gap-x-5 sm:gap-y-4">
              {legendChunks.map((chunk, chunkIndex) => (
                <div
                  key={`legend-chunk-${chunkIndex}`}
                  className="report-legend-chunk w-full min-w-0 shrink-0 sm:w-auto sm:max-w-[min(100%,20rem)] lg:max-w-[22rem]"
                >
                  <table
                    className="report-legend-table w-full border-separate border-spacing-x-0 border-spacing-y-1 text-[0.65rem] leading-relaxed sm:border-spacing-y-1.5 sm:text-xs sm:leading-relaxed"
                    aria-label={
                      legendChunks.length > 1
                        ? `Expense category breakdown, part ${chunkIndex + 1} of ${legendChunks.length}`
                        : "Expense category breakdown"
                    }
                  >
                    <tbody>
                      {chunk.map((slice) => (
                        <tr key={slice.id} className="report-legend-row">
                          {/*
                            Swatch + name in separate <td>s: table vertical-align matches in browser and html2canvas.
                            (Flex + PDF-only line-height overrides caused screen vs PDF to diverge.)
                          */}
                          <td className="report-legend-swatch-cell w-[1.25rem] py-1.5 pl-0 pr-1 text-center align-middle sm:w-8 sm:pr-1.5">
                            <svg
                              className="report-legend-swatch inline-block h-2.5 w-2.5 sm:h-3 sm:w-3"
                              viewBox="0 0 10 10"
                              aria-hidden="true"
                            >
                              <rect x="0" y="0" width="10" height="10" rx="2" fill={slice.color} />
                            </svg>
                          </td>
                          <td className="report-legend-label-cell min-w-0 max-w-[11rem] py-1.5 pr-2 align-middle sm:max-w-[15rem] sm:pr-3">
                            <span className="report-legend-name break-words text-slate-700 dark:text-slate-200">
                              {slice.categoryName}
                            </span>
                          </td>
                          <td className="whitespace-nowrap align-middle py-1.5 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200 sm:pr-3">
                            {formatMoney(slice.amount)}
                          </td>
                          <td className="whitespace-nowrap align-middle py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {(slice.pct * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}
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

