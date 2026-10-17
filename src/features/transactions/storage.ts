
import type { Transaction } from "./types";

const STORAGE_KEY = "budget-app:transactions:v1";

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== "object" || value === null) return false;

  const transaction = value as Record<string, unknown>;

  return (
    typeof transaction.id === "string" &&
    typeof transaction.description === "string" &&
    typeof transaction.amountCents === "number" &&
    Number.isSafeInteger(transaction.amountCents) &&
    transaction.amountCents > 0 &&
    typeof transaction.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(transaction.date) &&
    typeof transaction.categoryId === "string" &&
    (transaction.type === "expense" || transaction.type === "income")
  );
}

export function loadTransactions(): Transaction[] {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) return [];

    const parsed: unknown = JSON.parse(storedValue);

    if (Array.isArray(parsed) && parsed.every(isTransaction)) {
      return parsed;
    }
  } catch {
    // Return an empty list if storage is unavailable or invalid.
  }

  return [];
}

export function saveTransactions(
  transactions: Transaction[],
): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    return false;
  }
}
