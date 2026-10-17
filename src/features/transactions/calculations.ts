
import type { Transaction } from "./types";

export function calculateTotalExpensesCents(
  transactions: Transaction[],
): number {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}

export function calculateTotalIncomeCents(
  transactions: Transaction[],
): number {
  return transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}

export function calculateCategorySpendingCents(
  transactions: Transaction[],
  categoryId: string,
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.type === "expense" &&
        transaction.categoryId === categoryId,
    )
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}
