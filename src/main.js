import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { computeMonthlyReport, renderNarrative } from "./reporting/reportModel.js";

const el = (id) => document.getElementById(id);

const COUNTRY_TO_CURRENCY = {
  AE: "AED",
  AR: "ARS",
  AU: "AUD",
  BD: "BDT",
  BE: "EUR",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DE: "EUR",
  DK: "DKK",
  EG: "EGP",
  ES: "EUR",
  ET: "ETB",
  EU: "EUR",
  FR: "EUR",
  GB: "GBP",
  GH: "GHS",
  ID: "IDR",
  IE: "EUR",
  NG: "NGN",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KE: "KES",
  KR: "KRW",
  MA: "MAD",
  MX: "MXN",
  MY: "MYR",
  NL: "EUR",
  NO: "NOK",
  PH: "PHP",
  PK: "PKR",
  PL: "PLN",
  PT: "EUR",
  SA: "SAR",
  SE: "SEK",
  TH: "THB",
  TR: "TRY",
  TZ: "TZS",
  UG: "UGX",
  US: "USD",
  VN: "VND",
  ZA: "ZAR"
};

const THEME_STORAGE_KEY = "monthly-money-theme";

function show(elOrId) {
  const node = typeof elOrId === "string" ? el(elOrId) : elOrId;
  if (node) node.hidden = false;
}
function hide(elOrId) {
  const node = typeof elOrId === "string" ? el(elOrId) : elOrId;
  if (node) node.hidden = true;
}

function monthKeyFromDateString(dateStr) {
  // dateStr is YYYY-MM-DD
  const [y, m] = String(dateStr || "").split("-");
  if (!y || !m) return "";
  return `${y}-${m}`;
}

function parseDateToUtcTimestamp(dateStr) {
  // Keep date input stable by storing at UTC midnight.
  const [y, m, d] = String(dateStr || "").split("-");
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
  return Timestamp.fromDate(dt);
}

function shiftMonthKey(monthKey, deltaMonths) {
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

function formatMoney(amount, currency = "USD") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function getCurrencyForCountry(countryCode) {
  return COUNTRY_TO_CURRENCY[countryCode] || "USD";
}

function isStrongPassword(password) {
  const value = String(password || "");
  if (value.length < 8) return false;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasPunctuation = /[^A-Za-z0-9]/.test(value);
  return hasUpper && hasLower && hasNumber && hasPunctuation;
}

function applyTheme(theme) {
  const useDark = theme === "dark";
  document.body.classList.toggle("dark", useDark);
  const btn = el("theme-toggle-btn");
  if (btn) btn.textContent = useDark ? "Light mode" : "Dark mode";
}

function initThemeToggle() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
  applyTheme(storedTheme);

  const toggleBtn = el("theme-toggle-btn");
  if (!toggleBtn) return;
  toggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

function formatDate(isoLikeDate) {
  // We only store in Firestore as timestamp; in UI we use JS Date from it.
  if (!isoLikeDate) return "";
  const dt = isoLikeDate instanceof Date ? isoLikeDate : new Date(isoLikeDate);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

async function fetchCategories(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "categories"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchTransactionsForMonth(uid, monthKey) {
  const txCol = collection(db, "users", uid, "transactions");
  const q = query(txCol, where("monthKey", "==", monthKey), orderBy("date", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchTransactionsForMonthNoOrder(uid, monthKey) {
  // Fallback if Firestore index errors show up.
  const txCol = collection(db, "users", uid, "transactions");
  const q = query(txCol, where("monthKey", "==", monthKey));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderCategoriesList(categories) {
  const host = el("categories-list");
  if (!host) return;
  host.innerHTML = "";

  if (!categories.length) {
    host.innerHTML = `<div class="muted">No categories yet. Add one above.</div>`;
    return;
  }

  // Sort primarily by sortOrder then name.
  const sorted = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)));
  for (const c of sorted) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div><strong>${c.name}</strong></div>
      <div class="muted" style="margin-top:6px;">Type: ${c.type}</div>
      <div class="row" style="margin-top:10px;">
        <button data-action="delete-category" data-id="${c.id}" class="secondary">Delete</button>
      </div>
    `;
    host.appendChild(item);
  }
}

function renderTransactionsList(transactions, categories) {
  const host = el("transactions-list");
  if (!host) return;
  host.innerHTML = "";

  if (!transactions.length) {
    host.innerHTML = `<div class="muted">No transactions yet for this month.</div>`;
    return;
  }

  const catById = new Map((categories || []).map((c) => [c.id, c]));
  const recent = [...transactions].slice(-50).reverse();

  for (const t of recent) {
    const catName = catById.get(t.categoryId)?.name || "Unknown";
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "-";
    const amountStr = `${sign}${formatMoney(t.amount, currentCurrency)}`;
    const dateStr = t.date?.toDate ? formatDate(t.date.toDate()) : formatDate(t.date);

    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;">
        <div>
          <div><strong>${catName}</strong></div>
          <div class="muted" style="margin-top:6px;">${dateStr}</div>
        </div>
        <div style="text-align:right;">
          <div class="big" style="font-size:18px;">${amountStr}</div>
          <div class="muted" style="margin-top:6px;">${t.merchantOrPayee ? String(t.merchantOrPayee) : ""}</div>
        </div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button data-action="delete-transaction" data-id="${t.id}" class="secondary">Delete</button>
      </div>
    `;
    host.appendChild(item);
  }
}

function renderReport({ report, currency, monthKey, categories, hasLastMonth }) {
  el("report-title").textContent = `Report for ${monthKey} (monthly)`;

  const incomeTotal = report?.totals?.incomeTotal ?? 0;
  const expensesTotal = report?.totals?.expensesTotal ?? 0;
  const net = report?.totals?.net ?? 0;

  el("income-total").textContent = formatMoney(incomeTotal, currency);
  el("expense-total").textContent = formatMoney(expensesTotal, currency);
  el("net-total").textContent = formatMoney(net, currency);

  const tbody = el("expense-breakdown-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const breakdown = report?.breakdown || [];
  if (!breakdown.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">No expense categories for this month.</td></tr>`;
    return;
  }

  for (const row of breakdown) {
    const pct = (Number(row.pctOfExpenses) || 0) * 100;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.categoryName}</td>
      <td class="right">${formatMoney(row.amount, currency)}</td>
      <td class="right">${pct.toFixed(0)}%</td>
    `;
    tbody.appendChild(tr);
  }

  el("report-narrative").textContent = renderNarrative({
    report,
    currency,
    monthKey,
    hasLastMonth
  });
}

async function exportReportToPdf({ monthKey, currency }) {
  const reportRoot = el("report-root");
  if (!reportRoot) return;

  const exportBtn = el("export-pdf-btn");
  const status = el("report-status");
  exportBtn.disabled = true;
  const prevStatus = status.textContent;
  status.textContent = "Generating PDF...";

  try {
    // Switch to white-print styles so the PDF matches a clean export theme.
    document.body.classList.add("pdf-export");
    await new Promise((r) => setTimeout(r, 50));

    // html2pdf reads the current DOM (client-side first render), so what the user sees is what exports.
    const filename = `monthly-report-${monthKey}.pdf`;
    const opt = {
      margin: 0.4,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    };
    // eslint-disable-next-line no-undef
    await window.html2pdf().set(opt).from(reportRoot).save();
  } finally {
    document.body.classList.remove("pdf-export");
    status.textContent = prevStatus || "";
    exportBtn.disabled = false;
  }
}

async function deleteDocById(uid, collectionName, docId) {
  await deleteDoc(doc(db, "users", uid, collectionName, docId));
}

function setupTabNavigation() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const tabContent = Array.from(document.querySelectorAll(".tab-page"));

  function setActiveTab(tabKey) {
    for (const t of tabs) t.classList.toggle("active", t.dataset.tab === tabKey);
    for (const p of tabContent) p.hidden = p.id !== `tab-${tabKey}`;
  }

  for (const t of tabs) {
    t.addEventListener("click", () => {
      setActiveTab(t.dataset.tab);
    });
  }
}

function currentMonthKey() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

setupTabNavigation();

let currentCurrency = "USD";

let currentUid = null;
let cachedCategories = [];
let cachedTransactions = [];

async function saveUserProfile(uid, profile) {
  await setDoc(doc(db, "users", uid, "profile", "main"), {
    ...profile,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid, "profile", "main"));
  if (!snap.exists()) return null;
  return snap.data();
}

async function refreshCategories() {
  if (!currentUid) return;
  cachedCategories = await fetchCategories(currentUid);
  renderCategoriesList(cachedCategories);

  const txCategorySelect = el("tx-category");
  if (txCategorySelect) {
    txCategorySelect.innerHTML = "";
    for (const c of cachedCategories.filter((c) => c.isActive !== false)) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.type})`;
      txCategorySelect.appendChild(opt);
    }
  }
}

async function refreshTransactionsForMonth(monthKey) {
  if (!currentUid) return;
  el("report-status").textContent = "Loading report data...";
  let txs = [];
  try {
    txs = await fetchTransactionsForMonth(currentUid, monthKey);
  } catch (e) {
    // Firestore may require indexes for some query combos; fallback reduces risk.
    txs = await fetchTransactionsForMonthNoOrder(currentUid, monthKey);
  }
  cachedTransactions = txs;
  renderTransactionsList(cachedTransactions, cachedCategories);
  el("report-status").textContent = "";
}

async function refreshReportForMonth(monthKey) {
  if (!currentUid) return;

  el("report-status").textContent = "Computing report...";
  const txs = await (async () => {
    try {
      return await fetchTransactionsForMonth(currentUid, monthKey);
    } catch {
      return await fetchTransactionsForMonthNoOrder(currentUid, monthKey);
    }
  })();

  // Last-month comparison for narrative.
  const lastMonthKey = shiftMonthKey(monthKey, -1);
  let lastMonthTxs = [];
  if (lastMonthKey) {
    try {
      lastMonthTxs = await fetchTransactionsForMonth(currentUid, lastMonthKey);
    } catch {
      lastMonthTxs = await fetchTransactionsForMonthNoOrder(currentUid, lastMonthKey);
    }
  }

  const hasLastMonth = lastMonthTxs.length > 0;
  const report = computeMonthlyReport({
    transactions: txs,
    categories: cachedCategories,
    monthKey,
    lastMonthTransactions: lastMonthTxs
  });

  renderReport({ report, currency: currentCurrency, monthKey, categories: cachedCategories, hasLastMonth });
  el("report-status").textContent = "";
}

function wireActions() {
  const signOutBtn = el("sign-out-btn");
  const authEmail = el("auth-email");
  const authPassword = el("auth-password");
  const authPasswordConfirm = el("auth-password-confirm");
  const authFirstName = el("auth-first-name");
  const authOtherName = el("auth-other-name");
  const authLastName = el("auth-last-name");
  const authCountry = el("auth-country");
  const authCity = el("auth-city");
  const authCurrency = el("auth-currency");
  const authError = el("auth-error");

  const syncCurrencyFromCountry = () => {
    const autoCurrency = getCurrencyForCountry(authCountry.value);
    authCurrency.value = autoCurrency;
  };
  authCountry.addEventListener("change", syncCurrencyFromCountry);
  authCountry.addEventListener("input", syncCurrencyFromCountry);

  if (!authCurrency.value) authCurrency.value = "USD";

  signOutBtn.addEventListener("click", async () => {
    authError.textContent = "";
    try {
      const ok = confirm("Are you sure you want to sign out?");
      if (!ok) return;
      await signOut(auth);
    } catch (e) {
      authError.textContent = `Sign out failed: ${e?.message || e}`;
    }
  });

  el("sign-in-btn").addEventListener("click", async () => {
    authError.textContent = "";
    try {
      const email = authEmail.value.trim();
      const password = authPassword.value;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      authError.textContent = `Sign in failed: ${e?.message || e}`;
    }
  });

  el("sign-up-btn").addEventListener("click", async () => {
    authError.textContent = "";
    try {
      const firstName = authFirstName.value.trim();
      const otherName = authOtherName.value.trim();
      const lastName = authLastName.value.trim();
      const country = authCountry.value;
      const city = authCity.value.trim();
      const selectedCurrency = authCurrency.value || getCurrencyForCountry(country);

      if (!firstName || !lastName || !country || !city) {
        authError.textContent = "Create account requires first name, last name, country, and city.";
        return;
      }

      const email = authEmail.value.trim();
      const password = authPassword.value;
      const passwordConfirm = authPasswordConfirm.value;

      if (password !== passwordConfirm) {
        authError.textContent = "Password confirmation does not match.";
        return;
      }

      if (!isStrongPassword(password)) {
        authError.textContent =
          "Use a stronger password: minimum 8 characters with uppercase, lowercase, number, and punctuation.";
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await saveUserProfile(cred.user.uid, {
        firstName,
        otherName,
        lastName,
        country,
        city,
        currency: selectedCurrency,
        email
      });
    } catch (e) {
      authError.textContent = `Sign up failed: ${e?.message || e}`;
    }
  });

  el("category-form").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!currentUid) return;
    const type = el("category-type").value;
    const name = el("category-name").value.trim();
    const sortOrder = Number(el("category-sortOrder").value || 0);
    if (!name) return;

    await addDoc(collection(db, "users", currentUid, "categories"), {
      name,
      type,
      sortOrder,
      isActive: true,
      createdAt: serverTimestamp()
    });

    el("category-name").value = "";
    await refreshCategories();
  });

  document.addEventListener("click", async (evt) => {
    const target = evt.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (!action) return;

    if (action === "delete-category") {
      const id = target.dataset.id;
      if (!currentUid || !id) return;
      if (!confirm("Delete this category? Transactions will remain (shown as Unknown).")) return;
      await deleteDocById(currentUid, "categories", id);
      await refreshCategories();
      return;
    }

    if (action === "delete-transaction") {
      const id = target.dataset.id;
      if (!currentUid || !id) return;
      if (!confirm("Delete this transaction?")) return;
      await deleteDocById(currentUid, "transactions", id);
      const monthKey = el("month-picker").value;
      await refreshTransactionsForMonth(monthKey);
      await refreshReportForMonth(monthKey);
    }
  });

  el("transaction-form").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!currentUid) return;

    const dateStr = el("tx-date").value;
    const amount = Number(el("tx-amount").value);
    const categoryId = el("tx-category").value;
    const merchantOrPayee = el("tx-merchant").value.trim();
    const description = el("tx-description").value.trim();

    if (!dateStr || !Number.isFinite(amount) || !categoryId) return;

    const category = cachedCategories.find((c) => c.id === categoryId);
    if (!category) {
      alert("Selected category not found.");
      return;
    }

    const monthKey = monthKeyFromDateString(dateStr);
    const txTimestamp = parseDateToUtcTimestamp(dateStr);

    await addDoc(collection(db, "users", currentUid, "transactions"), {
      monthKey,
      date: txTimestamp,
      amount: Math.abs(amount),
      type: category.type,
      categoryId,
      merchantOrPayee,
      description,
      createdAt: serverTimestamp()
    });

    const selectedMonthKey = el("month-picker").value;
    if (selectedMonthKey === monthKey) {
      await refreshTransactionsForMonth(selectedMonthKey);
      await refreshReportForMonth(selectedMonthKey);
    }

    el("transaction-form").reset();
  });

  el("month-picker").addEventListener("change", async () => {
    if (!currentUid) return;
    const monthKey = el("month-picker").value;
    await refreshTransactionsForMonth(monthKey);
    await refreshReportForMonth(monthKey);
  });

  el("export-pdf-btn").addEventListener("click", async () => {
    if (!currentUid) return;
    const monthKey = el("month-picker").value;
    const exportCurrency = currentCurrency;
    await exportReportToPdf({ monthKey, currency: exportCurrency });
  });
}

wireActions();
initThemeToggle();

// Auth gate + app init.
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    const profile = await loadUserProfile(user.uid);
    currentCurrency = profile?.currency || "USD";
    const fullName = [profile?.firstName, profile?.otherName, profile?.lastName].filter(Boolean).join(" ").trim();
    const userLine = fullName ? `${fullName} (${user.email})` : user.email;
    el("signed-in-as").textContent = `Signed in as ${userLine} | ${currentCurrency}`;
    show("sign-out-btn");
    show("app-panel");
    hide("auth-panel");
    await refreshCategories();

    const mk = el("month-picker").value || currentMonthKey();
    el("month-picker").value = mk;

    await refreshTransactionsForMonth(mk);
    await refreshReportForMonth(mk);
  } else {
    currentUid = null;
    currentCurrency = "USD";
    el("signed-in-as").textContent = "";
    hide("sign-out-btn");
    hide("app-panel");
    show("auth-panel");
  }
});

