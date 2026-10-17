
export type BudgetGroup = "essentials" | "lifestyle" | "financial";

export type BudgetCategory = {
  id: string;
  name: string;
  group: BudgetGroup;
  plannedAmountCents: number;
};

export type BudgetPlan = {
  categories: BudgetCategory[];
};
