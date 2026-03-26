function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMoney(amount, currency = "USD", locale = "en-US") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    // Fallback for environments that don't support currency formatting.
    return `${n.toFixed(2)} ${currency}`;
  }
}

function safePct(numerator, denominator) {
  const d = Number(denominator) || 0;
  if (!d) return 0;
  return (Number(numerator) || 0) / d;
}

export function computeMonthlyReport({ transactions, categories, monthKey, lastMonthTransactions }) {
  // Normalize into arrays of expense/income transactions.
  const txs = Array.isArray(transactions) ? transactions : [];
  const catsById = new Map((categories || []).map((c) => [c.id, c]));

  const incomeTxs = txs.filter((t) => t.type === "income");
  const expenseTxs = txs.filter((t) => t.type === "expense");

  const incomeTotal = incomeTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const expensesTotal = expenseTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const net = incomeTotal - expensesTotal;

  const expenseByCategoryId = new Map();
  for (const t of expenseTxs) {
    const current = expenseByCategoryId.get(t.categoryId) || 0;
    expenseByCategoryId.set(t.categoryId, current + (Number(t.amount) || 0));
  }

  const breakdown = Array.from(expenseByCategoryId.entries())
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
  const top3Amount = breakdown.slice(0, 3).reduce((acc, b) => acc + b.amount, 0);
  const top3Concentration = safePct(top3Amount, expensesTotal);

  const lastTxs = Array.isArray(lastMonthTransactions) ? lastMonthTransactions : [];
  const lastExpenseTxs = lastTxs.filter((t) => t.type === "expense");
  const lastMonthExpensesTotal = lastExpenseTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const expensesDelta = expensesTotal - lastMonthExpensesTotal;
  const expensesDeltaPct = lastMonthExpensesTotal
    ? expensesDelta / lastMonthExpensesTotal
    : null;

  return {
    monthKey: monthKey || "",
    totals: { incomeTotal, expensesTotal, net },
    breakdown,
    narrative: {
      topCategoryName: topCategory ? topCategory.categoryName : null,
      top3Concentration,
      expensesDelta,
      expensesDeltaPct
    }
  };
}

function deltaToWord(deltaPct) {
  if (deltaPct == null) return null;
  if (deltaPct > 0.000001) return "increased";
  if (deltaPct < -0.000001) return "decreased";
  return "stayed the same";
}

function monthKeyToTitle(monthKey, locale = "en-US") {
  // monthKey is expected as YYYY-MM
  const [y, m] = String(monthKey || "").split("-");
  const year = Number(y);
  const monthIndex = Number(m) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return monthKey;
  const dt = new Date(Date.UTC(year, monthIndex, 1));
  return dt.toLocaleString(locale, { month: "long", year: "numeric" });
}

export function renderNarrative({
  report,
  currency = "USD",
  monthKey,
  hasLastMonth,
  locale = "en-US"
}) {
  const monthTitle = monthKeyToTitle(monthKey || report?.monthKey, locale);
  const { incomeTotal, expensesTotal } = report?.totals || { incomeTotal: 0, expensesTotal: 0 };
  const narrative = report?.narrative || {};

  const topCategoryName = narrative.topCategoryName;
  const top3ConcentrationPct = (Number(narrative.top3Concentration) || 0) * 100;

  const pctStr = `${top3ConcentrationPct.toFixed(0)}%`;
  const lines = [];

  // Line 1: Biggest category
  if (topCategoryName) {
    lines.push(`Your biggest expense category in ${monthTitle} was ${topCategoryName}.`);
  } else {
    lines.push(`You had no expenses recorded for ${monthTitle}.`);
  }

  // Line 2: Spending concentration
  if ((Number(narrative.top3Concentration) || 0) > 0 && expensesTotal > 0) {
    lines.push(`Your top 3 categories made up about ${pctStr} of your total spending.`);
  } else {
    lines.push(`No spending concentration insights are available for ${monthTitle} yet.`);
  }

  // Line 3: Month-over-month change (deterministic template)
  if (hasLastMonth) {
    const deltaWord = deltaToWord(narrative.expensesDeltaPct);
    if (deltaWord && narrative.expensesDeltaPct != null) {
      const absPct = Math.abs(narrative.expensesDeltaPct) * 100;
      const signMoney = narrative.expensesDelta >= 0 ? "+" : "-";
      const money = formatMoney(Math.abs(narrative.expensesDelta), currency, locale);
      lines.push(
        `Compared to last month, your total spending ${deltaWord} by ${signMoney}${money} (${absPct.toFixed(0)}%).`
      );
    } else {
      lines.push(`Compared to last month, your total spending stayed about the same.`);
    }
  } else {
    lines.push(`Set up last month's data to unlock a month-over-month comparison.`);
  }

  // Keep it short and readable for the PDF.
  return lines.join("\n");
}

