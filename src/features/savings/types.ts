
export type SavingsCategory =
  | "Emergency Fund"
  | "House Deposit"
  | "Investments"
  | "Other Long-Term Goals";

export interface SavingsGoal {
  id: string;
  name: string;
  category: SavingsCategory;
  targetAmountCents: number;
  savedAmountCents: number;
  createdAt: string;
}

export const SAVINGS_CATEGORIES: SavingsCategory[] = [
  "Emergency Fund",
  "House Deposit",
  "Investments",
  "Other Long-Term Goals",
];
