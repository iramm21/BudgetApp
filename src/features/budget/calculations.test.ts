
import { describe, expect, it } from "vitest";
import {
  calculateAllocationPercentage,
  calculateRemainingCents,
  calculateTotalAllocatedCents,
} from "./calculations";
import type { BudgetCategory } from "./types";

const categories: BudgetCategory[] = [
  {
    id: "rent",
    name: "Rent",
    group: "essentials",
    plannedAmountCents: 120000,
  },
  {
    id: "groceries",
    name: "Groceries",
    group: "essentials",
    plannedAmountCents: 25000,
  },
  {
    id: "savings",
    name: "Savings",
    group: "financial",
    plannedAmountCents: 50000,
  },
];

describe("budget calculations", () => {
  it("totals planned allocations", () => {
    expect(calculateTotalAllocatedCents(categories)).toBe(195000);
  });

  it("calculates money remaining", () => {
    expect(calculateRemainingCents(235658, 195000)).toBe(40658);
  });

  it("allows a negative balance when over budget", () => {
    expect(calculateRemainingCents(150000, 195000)).toBe(-45000);
  });

  it("calculates the percentage of income allocated", () => {
    expect(calculateAllocationPercentage(117829, 235658)).toBe(50);
  });

  it("returns zero percent when income is zero", () => {
    expect(calculateAllocationPercentage(10000, 0)).toBe(0);
  });
});
