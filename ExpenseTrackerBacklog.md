Below is a **production-ready, developer-grade specification** for your Expense Tracker updates. I’ve rewritten your requirements into structured, actionable items aligned with standard frontend + Firebase architecture practices.

---

# Expense Tracker — Feature Enhancement Specification

## 1. Authentication & OAuth Validation

**Objective:** Ensure reliability and correctness of social authentication flows.

**Requirements:**

* Validate OAuth sign-up and sign-in flows using Firebase Authentication providers (e.g., Google, Apple).
* Ensure:

  * User document is created in Firestore on first sign-in.
  * Existing users are not duplicated.
  * Proper error handling for failed authentication attempts.
* Persist user metadata:

  * `email`
  * `displayName`
  * `photoURL`
  * `preferredCurrency`

**Acceptance Criteria:**

* New users are correctly registered and stored.
* Returning users retain their existing data.
* No duplicate user records.

---

## 2. Currency Consistency Across Application

**Objective:** Maintain a single source of truth for user currency.

**Requirements:**

* Store selected currency in user profile (Firestore).
* Ensure all financial data (especially Reports) reference this currency.
* Format values using a standardized formatter (e.g., `Intl.NumberFormat`).

**Acceptance Criteria:**

* Currency displayed in Reports matches user-selected currency.
* Changes to currency propagate across all views without inconsistency.

---

## 3. Navigation Bar Redesign

**Objective:** Improve layout clarity and user experience.

### 3.1 Avatar Dropdown Component

**Requirements:**

* Add user avatar (from `photoURL`) in navbar.
* On click, display dropdown containing:

  * Dark Mode toggle
  * User email
  * Sign Out action
  * Delete Account action

---

### 3.2 Navigation Links Alignment

**Requirements:**

* Add navigation links:

  * Categories
  * Entries
  * Reports
* Align links horizontally on the middle side of the navbar.
* Ensure consistent spacing and responsiveness with avatar dropdown.

**Acceptance Criteria:**

* Navbar elements are visually aligned and responsive.
* Dropdown interaction is smooth and accessible.

---

## 4. Reports Page Enhancements

### 4.1 Tabular Data Presentation

**Requirements:**

* Display expense breakdown in a structured table.
* Columns may include:

  * Date
  * Category
  * Amount
  * Description

---

### 4.2 Data Interaction Features

**Requirements:**

* Implement:

  * Filtering (by date, category)
  * Search (text-based)
  * Sorting (ascending/descending by columns)
 * Implement pagination: Sorting (ascending/descending by columns)


**Acceptance Criteria:**

* Users can dynamically refine and organize data.
* Performance remains acceptable with large datasets.

---

### 4.3 Empty State Handling

**Requirements:**

* Display a centered empty-state UI when no data exists:

  * Illustration/image
  * Supporting message (e.g., “No expenses recorded yet”)

**Acceptance Criteria:**

* Empty state is visually centered and informative.

---

## 5. Categories Page Refinement

**Objective:** Simplify category display.

**Requirements:**

* Remove redundant labels such as “Income” and “Expense” from category listings.

**Acceptance Criteria:**

* Categories are displayed cleanly without unnecessary text.

---

## 6. Currency Selector Component

**Objective:** Allow dynamic currency updates.

**Requirements:**

* Add a currency dropdown selector:

  * Populate with supported currencies (e.g., USD, EUR, NGN, GBP).
  * Default value = user’s saved currency.
* On user profile page: 

  * Update Firestore user profile when currency changes. 
  * Trigger UI refresh across dependent components.

**Acceptance Criteria:**

* Currency updates reflect immediately across the application.

---

## 7. Entries Page UI Simplification

**Requirements:**

* Remove calendar component from header section.

**Acceptance Criteria:**

* Cleaner UI with no loss of functionality.

---

## 8. Transaction Form Validation UX

**Requirements:**

* Append `*` to all required form field labels.

**Acceptance Criteria:**

* Users can clearly identify mandatory fields.

---

## 9. Global Notification System

### 9.1 Alert Component

**Objective:** Provide consistent feedback across the app.

**Requirements:**

* Create a reusable alert/notification component:

  * Types: success, error, info
  * Auto-dismiss or manual close

---

### 9.2 Trigger Notifications

**Events requiring notifications:**

* Transaction successfully added
* Category successfully added

**Acceptance Criteria:**

* Notifications are visible, timely, and non-intrusive.

---

## Implementation Notes (Engineering Guidance)

* **State Management:**
  Use centralized state (Context API, Zustand, or Redux) for:

  * User data
  * Currency
  * Notifications

* **Componentization:**
  Break into reusable units:

  * `Navbar`
  * `AvatarDropdown`
  * `CurrencySelector`
  * `DataTable`
  * `EmptyState`
  * `Alert`

* **Firebase Integration:**

  * Use Firestore listeners (`onSnapshot`) for real-time updates where needed.
  * Ensure rules allow safe access to user-specific data only.

---

## Optional Enhancements (If You Want to Go Further)

* Pagination or virtualized tables for large datasets
 
* Skeleton loaders for improved perceived performance

---

If you want, I can now:

* Convert this into **actual React/Next.js + Firebase code components**, or
* Help you implement **one feature step-by-step (e.g., avatar dropdown or notification system)** without breaking your current app.