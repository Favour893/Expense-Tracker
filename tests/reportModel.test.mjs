import assert from "node:assert/strict";
import { computeMonthlyReport, renderNarrative } from "../src/reporting/reportModel.js";

function tx({ type, amount, categoryId }) {
  return {
    type,
    amount,
    categoryId
  };
}

// Basic aggregation + breakdown sort + percent correctness.
{
  const categories = [
    { id: "c1", name: "Groceries", type: "expense" },
    { id: "c2", name: "Rent", type: "expense" },
    { id: "i1", name: "Salary", type: "income" }
  ];

  const transactions = [
    tx({ type: "expense", amount: 100, categoryId: "c1" }),
    tx({ type: "expense", amount: 50, categoryId: "c2" }),
    tx({ type: "income", amount: 200, categoryId: "i1" })
  ];

  const report = computeMonthlyReport({
    transactions,
    categories,
    monthKey: "2026-03",
    lastMonthTransactions: []
  });

  assert.equal(report.totals.incomeTotal, 200);
  assert.equal(report.totals.expensesTotal, 150);
  assert.equal(report.totals.net, 50);

  assert.equal(report.breakdown.length, 2);
  assert.equal(report.breakdown[0].categoryName, "Groceries");
  assert.equal(report.breakdown[0].amount, 100);
  assert.equal(report.breakdown[1].categoryName, "Rent");
  assert.equal(report.breakdown[1].amount, 50);

  assert.equal(Math.round(report.breakdown[0].pctOfExpenses * 100), 67);
  assert.equal(Math.round(report.breakdown[1].pctOfExpenses * 100), 33);
}

// Narrative determinism (template-based).
{
  const categories = [
    { id: "c1", name: "Groceries", type: "expense" },
    { id: "c2", name: "Rent", type: "expense" },
    { id: "i1", name: "Salary", type: "income" }
  ];

  const transactions = [tx({ type: "expense", amount: 100, categoryId: "c1" }), tx({ type: "expense", amount: 50, categoryId: "c2" }), tx({ type: "income", amount: 200, categoryId: "i1" })];

  const lastMonthTransactions = [tx({ type: "expense", amount: 80, categoryId: "c1" })];

  const report = computeMonthlyReport({
    transactions,
    categories,
    monthKey: "2026-03",
    lastMonthTransactions
  });

  const narrative = renderNarrative({
    report,
    currency: "USD",
    monthKey: "2026-03",
    hasLastMonth: true,
    locale: "en-US"
  });

  const expected = [
    "Your biggest expense category in March 2026 was Groceries.",
    "Your top 3 categories made up 100.0% of your total spending.",
    "Compared to last month, your total spending increased by +$70.00 (88%)."
  ].join("\n");

  assert.equal(narrative, expected);
}

// Narrative without month-over-month comparison.
{
  const categories = [{ id: "c1", name: "Groceries", type: "expense" }];
  const transactions = [tx({ type: "expense", amount: 10, categoryId: "c1" })];

  const report = computeMonthlyReport({
    transactions,
    categories,
    monthKey: "2026-03",
    lastMonthTransactions: []
  });

  const narrative = renderNarrative({
    report,
    currency: "USD",
    monthKey: "2026-03",
    hasLastMonth: false,
    locale: "en-US"
  });

  assert.ok(narrative.includes("Set up last month's data to unlock a month-over-month comparison."));
}

console.log("reportModel tests passed");

