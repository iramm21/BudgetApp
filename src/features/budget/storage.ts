
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
  if (typeof value !== "object" || value === null) return false;

  const category = value as Record<string, unknown>;

  return (
    typeof category.id === "string" &&
    typeof category.name === "string" &&
    (category.group === "essentials" ||
      category.group === "lifestyle" ||
      category.group === "financial") &&
    typeof category.plannedAmountCents === "number" &&
    Number.isSafeInteger(category.plannedAmountCents) &&
    category.plannedAmountCents >= 0
  );
}

export function loadBudgetPlan(): BudgetPlan {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      return { categories: DEFAULT_CATEGORIES };
    }

    const parsed: unknown = JSON.parse(storedValue);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "categories" in parsed &&
      Array.isArray(parsed.categories) &&
      parsed.categories.every(isBudgetCategory)
    ) {
      return { categories: parsed.categories };
    }
  } catch {
    // Fall back to the default plan if storage is unavailable or invalid.
  }

  return { categories: DEFAULT_CATEGORIES };
}

export function saveBudgetPlan(plan: BudgetPlan): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}
