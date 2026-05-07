import type { Category, Transaction } from "../../types/app";

export type ExpenseBreakdownRow = {
  categoryId: string;
  categoryName: string;
  amount: number;
  pctOfExpenses: number; // 0..1
};

export type MonthlyReport = {
  monthKey: string;
  totals: {
    /** Sum of income transactions in the period (excludes carry-forward). */
    incomeFromEntries: number;
    /** Previous calendar month’s net (income − expenses); starting position for this month. */
    startingIncome: number;
    /** `startingIncome` + `incomeFromEntries` — what the UI labels “Income”. */
    incomeTotal: number;
    expensesTotal: number;
    net: number;
  };
  breakdown: ExpenseBreakdownRow[];
  narrative: {
    topCategoryName: string | null;
    top3Concentration: number; // 0..1
    /** Sum of each top-3 category’s % of total spending, rounded to one decimal. */
    top3PercentSumRounded1: number;
    expensesDelta: number;
    expensesDeltaPct: number | null;
  };
};

function safePct(numerator: number, denominator: number) {
  const d = Number(denominator) || 0;
  if (!d) return 0;
  return (Number(numerator) || 0) / d;
}

/**
 * Share of total spending (0..1) that the top 3 expense categories represent.
 * Matches summing each category’s share of the same total as the expense breakdown table
 * (aggregate by category, take the three largest category totals, divide by total expense amount).
 */
export function computeTop3ExpenseConcentration(expenseTransactions: Transaction[], categories: Category[]): number {
  const txs = Array.isArray(expenseTransactions) ? expenseTransactions.filter((t) => t.type === "expense") : [];
  const expensesTotal = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  if (expensesTotal <= 0) return 0;

  const expenseByCategoryId = new Map<string, number>();
  for (const t of txs) {
    const current = expenseByCategoryId.get(t.categoryId) || 0;
    expenseByCategoryId.set(t.categoryId, current + (Number(t.amount) || 0));
  }

  const breakdown = Array.from(expenseByCategoryId.entries())
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  const top3Amount = breakdown.slice(0, 3).reduce((acc, b) => acc + b.amount, 0);
  return safePct(top3Amount, expensesTotal);
}

/** Sum of (each top-3 category amount ÷ total × 100), rounded to one decimal. */
export function computeTop3ExpensePercentSumRounded1(expenseTransactions: Transaction[], categories: Category[]): number {
  const txs = Array.isArray(expenseTransactions) ? expenseTransactions.filter((t) => t.type === "expense") : [];
  const expensesTotal = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  if (expensesTotal <= 0) return 0;

  const expenseByCategoryId = new Map<string, number>();
  for (const t of txs) {
    const current = expenseByCategoryId.get(t.categoryId) || 0;
    expenseByCategoryId.set(t.categoryId, current + (Number(t.amount) || 0));
  }

  const breakdown = Array.from(expenseByCategoryId.entries())
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  const top3 = breakdown.slice(0, 3);
  const sumPct = top3.reduce((acc, row) => acc + safePct(row.amount, expensesTotal) * 100, 0);
  return Math.round(sumPct * 10) / 10;
}

/** e.g. `2026-04` → `April, 2026` (uses UTC month from YYYY-MM). */
export function formatReportMonthLabel(monthKey: string, locale = "en-GB"): string {
  const [y, m] = String(monthKey || "").split("-");
  const year = Number(y);
  const monthIndex = Number(m) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return String(monthKey || "");
  const dt = new Date(Date.UTC(year, monthIndex, 1));
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(dt);
  return `${monthName}, ${year}`;
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** e.g. `2026-01-15` / `2026-02-28` → `15 Jan 2026 – 28 Feb 2026` (local calendar dates). */
export function formatReportDateRangeLabel(startIso: string, endIso: string, locale = "en-GB"): string {
  const s = parseIsoDateLocal(startIso);
  const e = parseIsoDateLocal(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${startIso} – ${endIso}`;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const a = s.toLocaleDateString(locale, opts);
  const b = e.toLocaleDateString(locale, opts);
  if (startIso === endIso) return a;
  return `${a} – ${b}`;
}

/** Net cash flow for a set of transactions: sum(income) − sum(expenses). */
export function netFromTransactions(transactions: Transaction[]): number {
  const txs = Array.isArray(transactions) ? transactions : [];
  const income = txs.filter((t) => t.type === "income").reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const expenses = txs.filter((t) => t.type === "expense").reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  return income - expenses;
}

/** True when [startIso, endIso] is exactly one local-calendar month (day 1 → last day of that month). */
export function isFullCalendarMonthRange(startIso: string, endIso: string): boolean {
  const s = parseIsoDateLocal(startIso);
  const e = parseIsoDateLocal(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return false;
  if (s.getFullYear() !== e.getFullYear() || s.getMonth() !== e.getMonth()) return false;
  if (s.getDate() !== 1) return false;
  const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
  return e.getDate() === lastDay;
}

/** Calendar period immediately before `startIso`, same number of inclusive days as [startIso, endIso]. */
export function previousEqualCalendarRange(startIso: string, endIso: string): { start: string; end: string } | null {
  const s = parseIsoDateLocal(startIso);
  const e = parseIsoDateLocal(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return null;
  const dayCount = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - (dayCount - 1));
  return { start: toIsoDateLocal(prevStart), end: toIsoDateLocal(prevEnd) };
}

function monthKeyToTitle(monthKey: string, locale = "en-US") {
  const [y, m] = String(monthKey || "").split("-");
  const year = Number(y);
  const monthIndex = Number(m) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return monthKey;
  const dt = new Date(Date.UTC(year, monthIndex, 1));
  return dt.toLocaleString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
}

function deltaToWord(deltaPct: number | null) {
  if (deltaPct == null) return null;
  if (deltaPct > 0.000001) return "increased";
  if (deltaPct < -0.000001) return "decreased";
  return "stayed the same";
}

function formatMoney(amount: number, currency: string, locale = "en-US") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function computeMonthlyReport(opts: {
  transactions: Transaction[];
  categories: Category[];
  monthKey: string;
  lastMonthTransactions: Transaction[];
  /** Previous calendar month net; becomes starting income for this month when using full-month views. */
  startingIncome?: number;
}): MonthlyReport {
  const { transactions, categories, monthKey, lastMonthTransactions, startingIncome: startingIncomeOpt } = opts;
  const txs = Array.isArray(transactions) ? transactions : [];
  const catsById = new Map((categories || []).map((c) => [c.id, c]));

  const incomeTxs = txs.filter((t) => t.type === "income");
  const expenseTxs = txs.filter((t) => t.type === "expense");

  const incomeFromEntries = incomeTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const startingIncome = Number(startingIncomeOpt) || 0;
  const incomeTotal = startingIncome + incomeFromEntries;
  const expensesTotal = expenseTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const net = incomeTotal - expensesTotal;

  const expenseByCategoryId = new Map<string, number>();
  for (const t of expenseTxs) {
    const current = expenseByCategoryId.get(t.categoryId) || 0;
    expenseByCategoryId.set(t.categoryId, current + (Number(t.amount) || 0));
  }

  const breakdown: ExpenseBreakdownRow[] = Array.from(expenseByCategoryId.entries())
    .map(([categoryId, amount]) => {
      const cat = catsById.get(categoryId);
      return {
        categoryId,
        categoryName: cat ? cat.name : "Unknown",
        amount,
        pctOfExpenses: safePct(amount, expensesTotal)
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const topCategory = breakdown[0] || null;
  const top3Concentration = computeTop3ExpenseConcentration(expenseTxs, categories);
  const top3PercentSumRounded1 = computeTop3ExpensePercentSumRounded1(expenseTxs, categories);

  const lastTxs = Array.isArray(lastMonthTransactions) ? lastMonthTransactions : [];
  const lastExpenseTxs = lastTxs.filter((t) => t.type === "expense");
  const lastMonthExpensesTotal = lastExpenseTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const expensesDelta = expensesTotal - lastMonthExpensesTotal;
  const expensesDeltaPct = lastMonthExpensesTotal ? expensesDelta / lastMonthExpensesTotal : null;

  return {
    monthKey,
    totals: { incomeFromEntries, startingIncome, incomeTotal, expensesTotal, net },
    breakdown,
    narrative: {
      topCategoryName: topCategory ? topCategory.categoryName : null,
      top3Concentration,
      top3PercentSumRounded1,
      expensesDelta,
      expensesDeltaPct
    }
  };
}

export function renderNarrative(opts: {
  report: MonthlyReport;
  currency: string;
  monthKey: string;
  hasLastMonth: boolean;
  locale?: string;
  /** When set (e.g. custom date range), replaces calendar month title in all sentences. */
  periodLabel?: string;
  /** Sum of top-3 category % shares (0–100), rounded to one decimal; when set, matches filtered table basis. */
  top3PercentSumRounded1Override?: number | null;
  /** Total expense amount that the top-3 % line is relative to (e.g. filtered table total). */
  top3SpendingBasisTotal?: number | null;
}) {
  const {
    report,
    currency,
    monthKey,
    hasLastMonth,
    locale = "en-US",
    periodLabel,
    top3PercentSumRounded1Override,
    top3SpendingBasisTotal
  } = opts;
  const monthTitle = periodLabel || monthKeyToTitle(monthKey || report?.monthKey, locale);

  const { incomeTotal, expensesTotal, startingIncome = 0 } = report?.totals || {
    incomeTotal: 0,
    expensesTotal: 0,
    startingIncome: 0
  };
  const narrative = report?.narrative || ({} as MonthlyReport["narrative"]);

  const topCategoryName = narrative.topCategoryName;

  const top3PctDisplay =
    top3PercentSumRounded1Override != null && !Number.isNaN(Number(top3PercentSumRounded1Override))
      ? Number(top3PercentSumRounded1Override)
      : Number(narrative.top3PercentSumRounded1) || 0;
  const top3BasisTotal =
    top3SpendingBasisTotal != null && !Number.isNaN(Number(top3SpendingBasisTotal))
      ? Number(top3SpendingBasisTotal)
      : expensesTotal;

  const pctStr = `${top3PctDisplay.toFixed(1)}%`;
  const lines: string[] = [];

  if (topCategoryName) {
    lines.push(`Your biggest expense category in ${monthTitle} was ${topCategoryName}.`);
  } else {
    lines.push(`You had no expenses recorded for ${monthTitle}.`);
  }

  if (Math.abs(Number(startingIncome) || 0) > 1e-9) {
    const carry = formatMoney(Number(startingIncome) || 0, currency, locale);
    lines.push(
      `Your income total for this view includes ${carry} carried forward from the previous calendar month’s net (income minus expenses).`
    );
  }

  if (top3PctDisplay > 0 && top3BasisTotal > 0) {
    lines.push(`Your top 3 categories made up ${pctStr} of your total spending.`);
  } else {
    lines.push(`No spending concentration insights are available for ${monthTitle} yet.`);
  }

  if (hasLastMonth) {
    const deltaWord = deltaToWord(narrative.expensesDeltaPct);
    if (deltaWord && narrative.expensesDeltaPct != null) {
      const absPct = Math.abs(narrative.expensesDeltaPct) * 100;
      const signMoney = narrative.expensesDelta >= 0 ? "+" : "-";
      const money = formatMoney(Math.abs(narrative.expensesDelta), currency, locale);
      lines.push(
        `Compared to the previous period (same length), your total spending ${deltaWord} by ${signMoney}${money} (${absPct.toFixed(0)}%).`
      );
    } else {
      lines.push(`Compared to the previous period, your total spending stayed about the same.`);
    }
  } else {
    lines.push(`Add transactions for the calendar period immediately before this range to unlock a spending comparison.`);
  }

  return lines.join("\n");
}

export function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const [yStr, mStr] = String(monthKey || "").split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return "";
  const dt = new Date(Date.UTC(year, monthIndex, 1));
  dt.setUTCMonth(dt.getUTCMonth() + deltaMonths);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

