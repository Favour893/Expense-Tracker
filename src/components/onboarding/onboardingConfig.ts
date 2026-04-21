export const ONBOARDING_STORAGE_KEY = "expense-tracker-onboarding-v2";

export type OnboardingStep = {
  route: string;
  /** Matches `[data-tour="${target}"]` on screen while this step is active */
  target: string;
  title: string;
  body: string;
};

/** Ordered flow: Categories → Entries → Reports. Each step highlights one UI anchor. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Categories
  {
    route: "/categories",
    target: "nav-categories",
    title: "Categories in the nav",
    body: "Tap **Categories** here whenever you want to manage how income and expenses are labelled. Everything you add here appears when you record entries."
  },
  {
    route: "/categories",
    target: "categories-search-row",
    title: "Search and clear",
    body: "Use the field to **filter** by name. **Clear** resets the filter so you see the full list again."
  },
  {
    route: "/categories",
    target: "categories-tabs",
    title: "Income vs expense lists",
    body: "These tabs switch between **Income** and **Expense** categories. Counts show how many names you have in each list."
  },
  {
    route: "/categories",
    target: "categories-add",
    title: "Add or edit a category",
    body: "**+ Add category** opens the form to create a new label—or edit one from the list below when you tap Edit on a row."
  },
  // Entries
  {
    route: "/entries",
    target: "nav-entries",
    title: "Entries in the nav",
    body: "**Entries** is your ledger: every income or expense line you record for the month appears here."
  },
  {
    route: "/entries",
    target: "entries-add",
    title: "New transaction",
    body: "**Add** opens the form to enter date, amount, category, and description for this month."
  },
  {
    route: "/entries",
    target: "entries-month",
    title: "Which month?",
    body: "Choose the **month** you are working in. Amounts and lists below follow this period."
  },
  {
    route: "/entries",
    target: "entries-currency",
    title: "Display currency",
    body: "**Currency** controls how amounts are formatted on screen (your stored currency stays as entered)."
  },
  {
    route: "/entries",
    target: "entries-search-row",
    title: "Find transactions",
    body: "**Search** narrows the list; **Clear** removes the filter."
  },
  {
    route: "/entries",
    target: "entries-tabs",
    title: "Income vs expense ledger",
    body: "Same idea as Categories: flip between **Income** and **Expense** lines for the selected month."
  },
  // Reports
  {
    route: "/reports",
    target: "nav-reports",
    title: "Reports in the nav",
    body: "**Reports** rolls up your data for any date range you choose—preview, narrative, and exports."
  },
  {
    route: "/reports",
    target: "reports-range",
    title: "Report period",
    body: "**From** and **To** define the range for totals, preview, PDF, and the expense table below."
  },
  {
    route: "/reports",
    target: "reports-actions",
    title: "Narrative and PDF",
    body: "**Narrative** opens a written summary for the range. **Export to PDF** saves what you see in a printable layout."
  },
  {
    route: "/reports",
    target: "reports-preview",
    title: "Live preview",
    body: "This area shows the report snapshot for your range—scroll if the content is taller than the panel."
  },
  {
    route: "/reports",
    target: "reports-search",
    title: "Search expenses",
    body: "Filter rows in the expense breakdown table by **date, category, amount, or description**."
  }
];
