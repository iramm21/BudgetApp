
import type { BudgetCategory } from "./types";

export function calculateTotalAllocatedCents(
  categories: BudgetCategory[],
): number {
  return categories.reduce(
    (total, category) => total + category.plannedAmountCents,
    0,
  );
}

export function calculateRemainingCents(
  incomeCents: number,
  allocatedCents: number,
): number {
  return incomeCents - allocatedCents;
}

export function calculateAllocationPercentage(
  allocatedCents: number,
  incomeCents: number,
): number {
  if (incomeCents <= 0) return 0;

  return (allocatedCents / incomeCents) * 100;
}
