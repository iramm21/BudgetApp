
import type { SavingsGoal } from "./types";

const STORAGE_KEY = "budget-app-savings-goals";

export function loadSavingsGoals(): SavingsGoal[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (goal): goal is SavingsGoal =>
        typeof goal.id === "string" &&
        typeof goal.name === "string" &&
        typeof goal.category === "string" &&
        typeof goal.targetAmountCents === "number" &&
        Number.isFinite(goal.targetAmountCents) &&
        goal.targetAmountCents > 0 &&
        typeof goal.savedAmountCents === "number" &&
        Number.isFinite(goal.savedAmountCents) &&
        goal.savedAmountCents >= 0 &&
        typeof goal.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function saveSavingsGoals(goals: SavingsGoal[]): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    return true;
  } catch {
    return false;
  }
}
