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
export function formatReportMonthLabel(monthKey: string, locale = "en-US"): string {
  const [y, m] = String(monthKey || "").split("-");
  const year = Number(y);
  const monthIndex = Number(m) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return String(monthKey || "");
  const dt = new Date(Date.UTC(year, monthIndex, 1));
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(dt);
  return `${monthName}, ${year}`;
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
}): MonthlyReport {
  const { transactions, categories, monthKey, lastMonthTransactions } = opts;
  const txs = Array.isArray(transactions) ? transactions : [];
  const catsById = new Map((categories || []).map((c) => [c.id, c]));

  const incomeTxs = txs.filter((t) => t.type === "income");
  const expenseTxs = txs.filter((t) => t.type === "expense");

  const incomeTotal = incomeTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
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
    totals: { incomeTotal, expensesTotal, net },
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
  /** Sum of top-3 category % shares (0–100), rounded to one decimal; when set, matches filtered table basis. */
  top3PercentSumRounded1Override?: number | null;
  /** Total expense amount that the top-3 % line is relative to (e.g. filtered table total). */
  top3SpendingBasisTotal?: number | null;
}) {
  const { report, currency, monthKey, hasLastMonth, locale = "en-US", top3PercentSumRounded1Override, top3SpendingBasisTotal } = opts;
  const monthTitle = monthKeyToTitle(monthKey || report?.monthKey, locale);

  const { incomeTotal, expensesTotal } = report?.totals || { incomeTotal: 0, expensesTotal: 0 };
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
      lines.push(`Compared to last month, your total spending ${deltaWord} by ${signMoney}${money} (${absPct.toFixed(0)}%).`);
    } else {
      lines.push(`Compared to last month, your total spending stayed about the same.`);
    }
  } else {
    lines.push(`Set up last month's data to unlock a month-over-month comparison.`);
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

