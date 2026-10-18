
import type { BudgetCategory, BudgetPlan } from "./types";

const STORAGE_KEY = "budget-app:budget-plan:v1";

export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "rent", name: "Rent", group: "essentials", plannedAmountCents: 0 },
  { id: "groceries", name: "Groceries", group: "essentials", plannedAmountCents: 0 },
  { id: "utilities", name: "Electricity & water", group: "essentials", plannedAmountCents: 0 },
  { id: "phone-internet", name: "Phone & internet", group: "essentials", plannedAmountCents: 0 },
  { id: "transport", name: "Fuel & transport", group: "essentials", plannedAmountCents: 0 },
  { id: "car", name: "Car maintenance & registration", group: "essentials", plannedAmountCents: 0 },
  { id: "insurance-health", name: "Insurance & health", group: "essentials", plannedAmountCents: 0 },
  { id: "eating-out", name: "Eating out & takeaway", group: "lifestyle", plannedAmountCents: 0 },
  { id: "personal", name: "Personal spending", group: "lifestyle", plannedAmountCents: 0 },
  { id: "entertainment", name: "Dates & entertainment", group: "lifestyle", plannedAmountCents: 0 },
  { id: "subscriptions", name: "Subscriptions", group: "lifestyle", plannedAmountCents: 0 },
  { id: "savings", name: "Savings & investing", group: "financial", plannedAmountCents: 0 },
  { id: "debt", name: "Debt repayments", group: "financial", plannedAmountCents: 0 },
  { id: "other", name: "Other expenses", group: "financial", plannedAmountCents: 0 },
];

function isBudgetCategory(value: unknown): value is BudgetCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const category = value as Record<string, unknown>;

  return (
    typeof category.id === "string" &&
    category.id.trim().length > 0 &&
    typeof category.name === "string" &&
    category.name.trim().length > 0 &&
    (category.group === "essentials" ||
      category.group === "lifestyle" ||
      category.group === "financial") &&
    typeof category.plannedAmountCents === "number" &&
    Number.isSafeInteger(category.plannedAmountCents) &&
    category.plannedAmountCents >= 0
  );
}

function isBudgetPlan(value: unknown): value is BudgetPlan {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const plan = value as Record<string, unknown>;

  if (
    !Array.isArray(plan.categories) ||
    !plan.categories.every(isBudgetCategory)
  ) {
    return false;
  }

  const ids = plan.categories.map((category: BudgetCategory) => category.id);

  return new Set(ids).size === ids.length;
}

/**
 * Loads the saved budget plan from this browser.
 * Returns the default categories if storage is missing or invalid.
 */
export function loadBudgetPlan(): BudgetPlan {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      return { categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })) };
    }

    const parsed: unknown = JSON.parse(storedValue);

    if (isBudgetPlan(parsed)) {
      return {
        categories: parsed.categories.map((category) => ({ ...category })),
      };
    }
  } catch {
    // Fall back to defaults if storage is unavailable or invalid.
  }

  return {
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  };
}

/**
 * Saves a valid budget plan to this browser.
 * Returns false if validation or browser storage fails.
 */
export function saveBudgetPlan(plan: BudgetPlan): boolean {
  if (!isBudgetPlan(plan)) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}
